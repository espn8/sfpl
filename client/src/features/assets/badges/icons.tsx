type IconProps = {
  className?: string;
};

export function BrainIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        d="M12 4.5c-1.5 0-2.7.8-3.4 2-.3-.1-.7-.2-1.1-.2C5.6 6.3 4 7.9 4 9.8c0 .6.2 1.2.4 1.7C3.5 12.2 3 13.3 3 14.5c0 1.8 1.2 3.3 2.9 3.8.2 1.4 1.4 2.4 2.9 2.4.4 0 .8-.1 1.2-.2.7 1.2 1.9 2 3.4 2s2.7-.8 3.4-2c.3.1.7.2 1.2.2 1.5 0 2.7-1 2.9-2.4 1.7-.5 2.9-2 2.9-3.8 0-1.2-.5-2.3-1.4-3 .3-.5.4-1.1.4-1.7 0-1.9-1.6-3.5-3.5-3.5-.4 0-.8.1-1.1.2-.7-1.2-1.9-2-3.4-2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 4.5V12M12 12l-3 3M12 12l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M6 3h12v6a6 6 0 0 1-12 0V3zM9 21h6M12 15v6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
