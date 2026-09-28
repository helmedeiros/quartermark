import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { allowedChildTypesFor, TYPE_META } from "../../domain/tree";
import type { OkrNode, OkrNodeType } from "../../domain/model";

export function OkrRowMenu({
  node,
  disabled,
  onAddChild,
  onLinkJira,
  onDelete,
  triggerGlyph = "⋯",
  triggerClassName = "okr-row-menu-trigger",
}: {
  node: OkrNode;
  disabled: boolean;
  onAddChild: (type: OkrNodeType) => void;
  onLinkJira: () => void;
  onDelete?: () => void;
  triggerGlyph?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.right });
    }
    setOpen((v) => !v);
  };

  const childTypes = allowedChildTypesFor(node.type).filter(
    (t) => t !== "objective",
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        disabled={disabled}
        aria-label="More actions"
        onClick={toggle}
      >
        {triggerGlyph}
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={dropdownRef}
            className="okr-row-menu-dropdown okr-row-menu-dropdown-portal"
            role="menu"
            style={{ top: coords.top, left: coords.left }}
          >
            {childTypes.map((t) => (
              <button
                key={t}
                type="button"
                role="menuitem"
                className="okr-row-menu-item"
                onClick={() => {
                  setOpen(false);
                  onAddChild(t);
                }}
              >
                Add {TYPE_META[t].label}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              className="okr-row-menu-item"
              onClick={() => {
                setOpen(false);
                onLinkJira();
              }}
            >
              Link Jira issue
            </button>
            {onDelete && (
              <button
                type="button"
                role="menuitem"
                className="okr-row-menu-item okr-row-menu-item-danger"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                Delete
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
