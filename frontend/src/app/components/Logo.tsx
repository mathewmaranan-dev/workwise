import logoSrc from '../../assets/workwise-logo.png';

interface LogoProps {
  className?: string;
}

export default function Logo({ className = '' }: LogoProps) {
  return (
    <div className={`inline-flex items-center justify-center rounded-3xl bg-white p-2 shadow-lg shadow-slate-200 ${className}`}>
      <img src={logoSrc} alt="WorkWise logo" className="h-20 w-auto max-w-full" />
    </div>
  );
}
