import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.forecasting import TicketForecast


class ForecastingFallbackTests(unittest.TestCase):
    def test_falls_back_to_local_history_when_db_is_unavailable(self):
        forecaster = TicketForecast()
        forecaster.db_connector.available = False

        data = forecaster.get_historical_data(1, days=90)
        self.assertIsNotNone(data)
        self.assertFalse(data.empty)

        result = forecaster.forecast(1, days_ahead=7)
        self.assertNotIn('error', result)
        self.assertEqual(len(result['forecast']), 7)


if __name__ == '__main__':
    unittest.main()
