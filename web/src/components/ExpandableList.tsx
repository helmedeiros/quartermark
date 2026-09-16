import { useState } from "react";
import type { ReactNode } from "react";

export interface ExpandableItem {
  id: string;
  summary: ReactNode;
  details: ReactNode;
}

export function ExpandableList({ items }: { items: ExpandableItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="expandable-list">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="expandable-item">
            <button
              className="expandable-summary"
              onClick={() => setOpenId(isOpen ? null : item.id)}
            >
              <span className={`expandable-caret${isOpen ? " open" : ""}`}>
                ▸
              </span>
              {item.summary}
            </button>
            {isOpen && <div className="expandable-details">{item.details}</div>}
          </div>
        );
      })}
    </div>
  );
}
