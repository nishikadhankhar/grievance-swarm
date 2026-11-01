interface StarterItem {
  id: string;
  title: string;
  description: string;
  starter: string;
  icon: JSX.Element;
  iconBg: string;
}

const STARTERS: StarterItem[] = [
  {
    id: "wifi",
    title: "Wi-Fi & Network",
    description: "Slow, disconnecting, or dead internet on your floor or room.",
    starter: "Wi-Fi is not working on 2nd floor since evening. Router lights are off.",
    iconBg: "bg-blue-50 text-blue-600 border-blue-200",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13a10 10 0 0 1 14 0" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" />
        <path d="M2 8.82a15 15 0 0 1 20 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
  },
  {
    id: "electricity",
    title: "Electricity",
    description: "Geyser tripping, power cut, flickering lights, or faulty switch.",
    starter: "Geyser is not heating and the MCB breaker trips whenever turned on.",
    iconBg: "bg-amber-50 text-amber-600 border-amber-200",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: "water",
    title: "Water & RO",
    description: "Slow RO dispenser in mess, pipe leak, or no water in washroom.",
    starter: "RO water dispenser is running extremely slow and water pressure is low.",
    iconBg: "bg-cyan-50 text-cyan-600 border-cyan-200",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
  },
  {
    id: "other",
    title: "Other Repairs",
    description: "Broken furniture, room door lock, mess hygiene, or windows.",
    starter: "Door lock latch is stuck and window hinge is loose in my room.",
    iconBg: "bg-purple-50 text-purple-600 border-purple-200",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

interface StarterCardsProps {
  onSelect: (starter: string) => void;
}

export function StarterCards({ onSelect }: StarterCardsProps) {
  return (
    <div className="mt-8 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 tracking-tight">
          Common problems
        </h3>
        <span className="text-xs text-gray-400">
          Click to pre-fill starter template
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {STARTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.starter)}
            className="group flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500/20 active:translate-y-0"
          >
            <div>
              <div
                className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border ${item.iconBg} shadow-sm group-hover:scale-105 transition-transform`}
              >
                {item.icon}
              </div>
              <h4 className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                {item.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500 leading-relaxed">
                {item.description}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Use template</span>
              <span>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

