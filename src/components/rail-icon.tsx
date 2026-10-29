/** Outline icons for the side rail. One stroke, one weight. */

export function RailIcon({ name }: { name: "schedule" | "team" | "constraints" | "insights" | "messages" | "absences" | "business" | "attendance" }) {
  const common = {
    viewBox: "0 0 20 20",
    className: "h-4 w-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "schedule") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="14" height="12.5" rx="1.5" />
        <path d="M3 8h14M7 2.8v2.4M13 2.8v2.4" />
      </svg>
    );
  }
  if (name === "team") {
    return (
      <svg {...common}>
        <circle cx="7.2" cy="7" r="2.2" />
        <path d="M3.2 15.4c.5-2.3 2-3.6 4-3.6s3.5 1.3 4 3.6" />
        <circle cx="13.4" cy="7.6" r="1.7" />
        <path d="M12.2 15.4c.3-1.5 1.2-2.5 2.4-2.8" />
      </svg>
    );
  }
  if (name === "constraints") {
    return (
      <svg {...common}>
        <path d="M6.5 5.5h9.5M6.5 10h9.5M6.5 14.5h6" />
        <circle cx="4" cy="5.5" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="4" cy="10" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="4" cy="14.5" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "insights") {
    return (
      <svg {...common}>
        <path d="M3.5 15.5V10M8.2 15.5V4.5M12.8 15.5V8M16.5 15.5V6" />
      </svg>
    );
  }
  if (name === "absences") {
    return (
      <svg {...common}>
        <rect x="3.5" y="4.5" width="13" height="12" rx="1.5" />
        <path d="M3.5 8h13M7 3v2.5M13 3v2.5M8 11.2l4 4M12 11.2l-4 4" />
      </svg>
    );
  }
  if (name === "messages") {
    return (
      <svg {...common}>
        <rect x="3.2" y="5" width="13.6" height="10" rx="1.4" />
        <path d="M4 6.2 10 11l6-4.8" />
      </svg>
    );
  }
  if (name === "attendance") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="6.5" />
        <path d="M10 6.5V10l2.4 1.6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 16.5V8.5L10 4l6 4.5v8" />
      <path d="M8 16.5v-4.5h4v4.5" />
    </svg>
  );
}
