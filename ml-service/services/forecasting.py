"""
Ticket Volume Forecasting Module

Uses ARIMA with auto-parameter selection to predict future ticket volumes.
"""

import logging
import warnings
from itertools import product

import numpy as np
import pandas as pd

from services.database_integration import DatabaseConnector

logger = logging.getLogger(__name__)

try:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    from statsmodels.tsa.stattools import adfuller
    STATS_MODELS_AVAILABLE = True
except ImportError:
    ARIMA = None
    SARIMAX = None
    ExponentialSmoothing = None
    adfuller = None
    STATS_MODELS_AVAILABLE = False

# Suppress convergence warnings for synthetic data
if STATS_MODELS_AVAILABLE:
    warnings.filterwarnings('ignore', category=UserWarning, module='statsmodels')


class TicketForecast:
    def __init__(self):
        self.model = None
        self.best_order = None
        self.trend = None
        self.db_connector = DatabaseConnector()
        if self.db_connector.available:
            self.db_connector.connect()

    def _build_historical_series(self, assignment_group_id, days=90):
        if self.db_connector.available:
            try:
                tickets = self.db_connector.get_tickets(days_back=days, group_id=assignment_group_id, strict=True)
                if not tickets:
                    # Retry with broader history window for sparse datasets.
                    tickets = self.db_connector.get_tickets(days_back=max(days, 3650), group_id=assignment_group_id, strict=True)
                if not tickets and assignment_group_id is not None:
                    # Fallback to all groups when a specific group has no ticket history.
                    tickets = self.db_connector.get_tickets(days_back=max(days, 3650), group_id=None, strict=True)
                logger.info(f"DB query returned {len(tickets) if tickets else 0} tickets for group {assignment_group_id}")
                if tickets:
                    df = pd.DataFrame(tickets)
                    if 'created_at' in df.columns:
                        df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
                        df = df.dropna(subset=['created_at'])
                        if df.empty:
                            logger.warning(f"Tickets fetched for group {assignment_group_id} but all created_at values were invalid")
                            return None

                        df = df.set_index('created_at').sort_index()
                        observed_daily_counts = df.resample('D').size()
                        if observed_daily_counts.empty:
                            logger.warning(f"No daily bins available after resampling for group {assignment_group_id}")
                            return None

                        last_observed_day = observed_daily_counts.index.max().normalize()
                        first_observed_day = observed_daily_counts.index.min().normalize()
                        window_start = max(first_observed_day, last_observed_day - pd.Timedelta(days=days - 1))
                        date_index = pd.date_range(start=window_start, end=last_observed_day, freq='D')
                        daily_counts = observed_daily_counts.reindex(date_index, fill_value=0)
                        logger.info(f"Built historical series from DB with {len(daily_counts)} days, mean={daily_counts.mean():.2f}")
                        return daily_counts.reset_index().rename(columns={'index': 'date', 0: 'ticket_volume'})
                else:
                    logger.info(f"No DB tickets found for group {assignment_group_id}")
            except Exception as e:
                logger.error(f"DB query failed for group {assignment_group_id}: {e}")
                raise RuntimeError(f"Database query failed: {e}") from e

        if not self.db_connector.available:
            logger.error("No DB historical ticket data available because database connector is unavailable")
            return None
        return None

    def get_historical_data(self, assignment_group_id, days=90):
        return self._build_historical_series(assignment_group_id, days=days)

    def _detect_trend(self, series):
        """Detect trend direction in time series"""
        if len(series) < 2:
            return 'flat'
        
        first_half = series[:len(series)//2].mean()
        second_half = series[len(series)//2:].mean()
        
        trend_change = (second_half - first_half) / (first_half + 1e-6)
        
        if trend_change > 0.05:
            return 'increasing'
        elif trend_change < -0.05:
            return 'decreasing'
        else:
            return 'flat'

    def _calculate_forecast_quality(self, residuals, history_mean):
        """Convert residual diagnostics into a quality score and confidence."""
        clean_residuals = np.asarray(residuals)
        clean_residuals = clean_residuals[~np.isnan(clean_residuals)]
        if clean_residuals.size == 0:
            return {
                'quality': 'unknown',
                'quality_score': 0.5,
                'confidence': 0.55,
                'forecast_error_std': 0.0,
                'mae': 0.0,
            }

        std = float(np.std(clean_residuals))
        mae = float(np.mean(np.abs(clean_residuals)))
        normalized_error = mae / (abs(history_mean) + 1e-6)
        quality_score = float(np.clip(1.0 - normalized_error * 0.8, 0.3, 0.98))

        if quality_score >= 0.85:
            quality = 'high'
        elif quality_score >= 0.65:
            quality = 'medium'
        else:
            quality = 'low'

        confidence = float(np.clip(quality_score, 0.5, 0.98))
        return {
            'quality': quality,
            'quality_score': quality_score,
            'confidence': confidence,
            'forecast_error_std': std,
            'mae': mae,
        }

    def _find_optimal_arima_order(self, series, max_p=2, max_d=1, max_q=2):
        """Find optimal ARIMA parameters using grid search and AIC"""
        if ARIMA is None:
            return (1, 1, 1)

        best_aic = np.inf
        best_order = (1, 1, 1)
        
        try:
            # For synthetic/clean data, be more conservative with differencing
            is_stationary = len(set(series[1:] - series[:-1])) > 1
            d_values = [1] if is_stationary else [0, 1]
        except:
            d_values = [0, 1]
        
        # Try simpler models first for stability
        for p, d, q in [(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0), (1, 1, 1)]:
            if p > max_p or d > max(d_values) or q > max_q:
                continue
                
            try:
                model = ARIMA(series, order=(p, d, q))
                # Suppress convergence warnings for synthetic data
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    fitted = model.fit()
                
                if fitted.aic < best_aic:
                    best_aic = fitted.aic
                    best_order = (p, d, q)
            except:
                continue
        
        return best_order

    def _find_optimal_sarima_order(self, series, seasonal_period=7, max_p=1, max_d=1, max_q=1, max_P=1, max_D=1, max_Q=1):
        """Find optimal SARIMA parameters using grid search and AIC"""
        if SARIMAX is None:
            return (1, 1, 1, 0, 1, 1, seasonal_period)

        best_aic = np.inf
        best_order = (1, 1, 1, 0, 1, 1, seasonal_period)

        for p in range(0, max_p + 1):
            for d in range(0, max_d + 1):
                for q in range(0, max_q + 1):
                    for P in range(0, max_P + 1):
                        for D in range(0, max_D + 1):
                            for Q in range(0, max_Q + 1):
                                try:
                                    model = SARIMAX(
                                        series,
                                        order=(p, d, q),
                                        seasonal_order=(P, D, Q, seasonal_period),
                                        enforce_stationarity=False,
                                        enforce_invertibility=False,
                                    )
                                    import warnings
                                    with warnings.catch_warnings():
                                        warnings.simplefilter("ignore")
                                        fitted = model.fit(disp=False)

                                    if fitted.aic < best_aic:
                                        best_aic = fitted.aic
                                        best_order = (p, d, q, P, D, Q, seasonal_period)
                                except Exception:
                                    continue

        return best_order

    def _fit_ets(self, series):
        if ExponentialSmoothing is None:
            return None

        try:
            if len(series) < 14:
                return None

            model = ExponentialSmoothing(
                series,
                trend='add',
                seasonal='add',
                seasonal_periods=7,
                initialization_method='estimated'
            )
            fitted = model.fit(optimized=True, use_brute=True)
            return fitted
        except Exception:
            return None

    def _weekday_seasonality_factors(self, series):
        values = np.asarray(series, dtype=float)
        if values.size == 0:
            return np.ones(7, dtype=float)

        sample_size = min(values.size, 56)
        recent = values[-sample_size:]
        weekday_values = {i: [] for i in range(7)}

        # Align the sequence so the final observed point is treated as day index 6.
        for idx, val in enumerate(recent):
            day_idx = (idx - (sample_size - 1)) % 7
            weekday_values[day_idx].append(float(val))

        weekday_means = np.array([
            float(np.mean(weekday_values[i])) if weekday_values[i] else float(np.mean(recent))
            for i in range(7)
        ])
        denom = float(np.mean(weekday_means)) or 1.0
        factors = weekday_means / denom
        return np.clip(factors, 0.82, 1.20)

    def _stabilize_forecast_path(self, series, raw_forecast):
        history = np.asarray(series, dtype=float)
        forecast = np.asarray(raw_forecast, dtype=float)
        if history.size < 14 or forecast.size == 0:
            return np.maximum(forecast, 0)

        horizon = forecast.size
        recent_window = history[-min(history.size, 28):]
        last_week_window = history[-7:] if history.size >= 7 else history
        prev_week_window = history[-14:-7] if history.size >= 14 else history[: max(1, history.size // 2)]

        recent_mean = float(np.mean(recent_window))
        last_level = float(np.mean(last_week_window))
        prev_level = float(np.mean(prev_week_window)) if prev_week_window.size > 0 else last_level

        # Use a conservative, damped slope so growth/decline does not explode.
        raw_weekly_change = last_level - prev_level
        daily_slope = float(np.clip(raw_weekly_change / 7.0, -0.9, 0.9))
        weekday_factors = self._weekday_seasonality_factors(history)

        stabilized = np.zeros(horizon, dtype=float)
        previous_value = max(0.0, last_level)
        for idx in range(horizon):
            t = idx + 1

            trend_component = daily_slope * t * np.exp(-t / 18.0)
            reversion_component = (recent_mean - last_level) * (1.0 - np.exp(-t / 26.0))
            baseline = max(0.0, last_level + trend_component + reversion_component)
            seasonal_baseline = baseline * weekday_factors[idx % 7]

            # Lean more on stabilized baseline as horizon extends.
            baseline_weight = min(0.35 + 0.45 * (t / max(horizon, 1)), 0.80)
            combined = (1.0 - baseline_weight) * forecast[idx] + baseline_weight * seasonal_baseline

            # Clamp day-over-day movement to avoid unrealistic spikes.
            max_increase = previous_value * 1.12 + 8.0
            max_decrease = max(0.0, previous_value * 0.86 - 8.0)
            combined = float(np.clip(combined, max_decrease, max_increase))

            stabilized[idx] = max(0.0, combined)
            previous_value = stabilized[idx]

        return stabilized

    def forecast(self, assignment_group_id, days_ahead=7):
        try:
            data = self.get_historical_data(assignment_group_id)
            if data is None or data.empty:
                return {
                    'error': 'No DB ticket history available for forecasting. Ensure ML service DATABASE_URL points to the active WorkWise database.',
                    'code': 'NO_DB_HISTORY',
                }
            series = data['ticket_volume'].values
            data_source = 'db'
            
            # Detect trend
            self.trend = self._detect_trend(series)

            # Try a SARIMA model first for ticket volume with weekly seasonality
            sarima_order = self._find_optimal_sarima_order(series, seasonal_period=7)
            if SARIMAX is not None and sarima_order is not None:
                try:
                    p, d, q, P, D, Q, s = sarima_order
                    sarima_model = SARIMAX(
                        series,
                        order=(p, d, q),
                        seasonal_order=(P, D, Q, s),
                        enforce_stationarity=False,
                        enforce_invertibility=False,
                    )
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        sarima_fit = sarima_model.fit(disp=False)

                    forecast = sarima_fit.get_forecast(steps=days_ahead)
                    forecast_ci = forecast.conf_int()
                    forecast_values = np.asarray(forecast.predicted_mean)

                    sigma = float(np.std(sarima_fit.resid[~np.isnan(sarima_fit.resid)])) if sarima_fit.resid.size else 0.0
                    history_mean = float(np.mean(series))
                    quality = self._calculate_forecast_quality(sarima_fit.resid, history_mean)

                    if hasattr(forecast_ci, 'iloc'):
                        upper_vals = np.asarray(forecast_ci.iloc[:, 1])
                        lower_vals = np.asarray(forecast_ci.iloc[:, 0])
                    else:
                        upper_vals = np.asarray(forecast_ci)[:, 1]
                        lower_vals = np.asarray(forecast_ci)[:, 0]

                    stabilized_forecast = self._stabilize_forecast_path(series, forecast_values)
                    upper_width = np.maximum(upper_vals - forecast_values, 1.0)
                    lower_width = np.maximum(forecast_values - lower_vals, 1.0)
                    upper_vals = stabilized_forecast + upper_width
                    lower_vals = stabilized_forecast - lower_width

                    upper_bound = np.maximum(upper_vals, 0).astype(float).tolist()
                    lower_bound = np.maximum(lower_vals, 0).astype(float).tolist()

                    return {
                        'forecast': np.maximum(stabilized_forecast, 0).astype(float).tolist(),
                        'lower_bound': lower_bound,
                        'upper_bound': upper_bound,
                        'model': f'SARIMA{(p, d, q)}x{(P, D, Q, s)}',
                        'rsquared': float(sarima_fit.rsquared if hasattr(sarima_fit, 'rsquared') else 0),
                        'trend': self.trend,
                        'aic': float(sarima_fit.aic) if hasattr(sarima_fit, 'aic') else 0,
                        'bic': float(sarima_fit.bic) if hasattr(sarima_fit, 'bic') else 0,
                        'quality': quality['quality'],
                        'quality_score': quality['quality_score'],
                        'confidence': quality['confidence'],
                        'forecast_error_std': quality['forecast_error_std'],
                        'mae': quality['mae'],
                        'history_stats': {
                            'mean': history_mean,
                            'std': float(np.std(series)),
                            'min': float(np.min(series)),
                            'max': float(np.max(series)),
                            'last': float(series[-1]),
                        },
                        'data_source': data_source,
                    }
                except Exception as exc:
                    logger.warning('SARIMA model fit failed, falling back to ETS', exc_info=True)

            # Fall back to ETS for robust weekly patterns if SARIMA fails
            ets_model = self._fit_ets(series)
            if ets_model is not None:
                forecast_values = ets_model.forecast(steps=days_ahead)
                stabilized_forecast = self._stabilize_forecast_path(series, forecast_values)
                residuals = np.asarray(ets_model.resid)
                sigma = float(np.std(residuals[~np.isnan(residuals)])) if residuals.size else 0.0
                history_mean = float(np.mean(series))
                quality = self._calculate_forecast_quality(residuals, history_mean)

                upper_bound = np.maximum(stabilized_forecast + 1.96 * sigma, 0).astype(float).tolist()
                lower_bound = np.maximum(stabilized_forecast - 1.96 * sigma, 0).astype(float).tolist()

                return {
                    'forecast': np.maximum(stabilized_forecast, 0).astype(float).tolist(),
                    'lower_bound': lower_bound,
                    'upper_bound': upper_bound,
                    'model': 'ETS(additive, weekly)',
                    'rsquared': float(ets_model.rsquared if hasattr(ets_model, 'rsquared') else 0),
                    'trend': self.trend,
                    'aic': float(ets_model.aic) if hasattr(ets_model, 'aic') else 0,
                    'bic': float(ets_model.bic if hasattr(ets_model, 'bic') else 0),
                    'quality': quality['quality'],
                    'quality_score': quality['quality_score'],
                    'confidence': quality['confidence'],
                    'forecast_error_std': quality['forecast_error_std'],
                    'mae': quality['mae'],
                    'history_stats': {
                        'mean': history_mean,
                        'std': float(np.std(series)),
                        'min': float(np.min(series)),
                        'max': float(np.max(series)),
                        'last': float(series[-1]),
                    },
                    'data_source': data_source,
                }

            # Fall back to ARIMA if available.
            if ARIMA is not None:
                self.best_order = self._find_optimal_arima_order(series)
                model = ARIMA(series, order=self.best_order)
                fitted_model = model.fit()

                forecast = fitted_model.get_forecast(steps=days_ahead)
                forecast_ci = forecast.conf_int()
                raw_forecast_values = np.asarray(forecast.predicted_mean.values, dtype=float)
                stabilized_forecast = self._stabilize_forecast_path(series, raw_forecast_values)

                rsquared = fitted_model.rsquared if hasattr(fitted_model, 'rsquared') else 0
                
                upper_raw = np.asarray(forecast_ci.iloc[:, 1].values, dtype=float)
                lower_raw = np.asarray(forecast_ci.iloc[:, 0].values, dtype=float)
                upper_width = np.maximum(upper_raw - raw_forecast_values, 1.0)
                lower_width = np.maximum(raw_forecast_values - lower_raw, 1.0)
                upper_bound = np.maximum(stabilized_forecast + upper_width, 0).astype(float).tolist()
                lower_bound = np.maximum(stabilized_forecast - lower_width, 0).astype(float).tolist()
                
                if self.trend == 'increasing':
                    upper_bound = [u * 1.1 for u in upper_bound]
                elif self.trend == 'decreasing':
                    lower_bound = [max(l * 0.9, 10) for l in lower_bound]

                history_mean = float(np.mean(series))
                residuals = (forecast.predicted_mean.values - series[-len(forecast.predicted_mean.values):]) if len(series) >= len(forecast.predicted_mean.values) else forecast.predicted_mean.values - history_mean
                quality = self._calculate_forecast_quality(residuals, history_mean)

                return {
                    'forecast': np.maximum(stabilized_forecast, 0).astype(float).tolist(),
                    'lower_bound': lower_bound,
                    'upper_bound': upper_bound,
                    'model': f'ARIMA{self.best_order}',
                    'rsquared': float(rsquared),
                    'trend': self.trend,
                    'aic': float(fitted_model.aic) if hasattr(fitted_model, 'aic') else 0,
                    'bic': float(fitted_model.bic) if hasattr(fitted_model, 'bic') else 0,
                    'quality': quality['quality'],
                    'quality_score': quality['quality_score'],
                    'confidence': quality['confidence'],
                    'forecast_error_std': quality['forecast_error_std'],
                    'mae': quality['mae'],
                    'history_stats': {
                        'mean': history_mean,
                        'std': float(np.std(series)),
                        'min': float(np.min(series)),
                        'max': float(np.max(series)),
                        'last': float(series[-1]),
                    },
                    'data_source': data_source,
                }

            return {
                'error': 'Forecasting models are unavailable in the ML runtime.',
                'code': 'MODEL_UNAVAILABLE',
            }

        except Exception as e:
            return {
                'error': f'Forecasting pipeline failed: {e}',
                'code': 'FORECAST_PIPELINE_FAILED',
            }
