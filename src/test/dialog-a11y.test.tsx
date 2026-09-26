import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { Modal, SlideOver, Btn } from "@/components/ui-bits";

/**
 * Both overlays were plain divs: no role, no accessible name, no focus
 * boundary. Tab walked out of the panel into the page behind it, and closing
 * one dropped focus back to the document body rather than to whatever opened
 * it. These pin the four things that fixes, for both components, because they
 * now share one implementation and a regression in it would be silent.
 */
function Harness({ kind }: { kind: "modal" | "slideover" }) {
  const [open, setOpen] = useState(false);
  const Panel = kind === "modal" ? Modal : SlideOver;
  return (
    <div>
      <Btn onClick={() => setOpen(true)}>Open panel</Btn>
      <Btn onClick={() => { /* a target outside the panel for Tab to escape to */ }}>Outside</Btn>
      <Panel open={open} onClose={() => setOpen(false)} title="Billing Engine DB">
        <Btn onClick={() => { /* first */ }}>Inside one</Btn>
        <Btn onClick={() => { /* last */ }}>Inside two</Btn>
      </Panel>
    </div>
  );
}

describe.each(["modal", "slideover"] as const)("%s dialog semantics", kind => {
  it("exposes a dialog named by its heading", async () => {
    render(<Harness kind={kind} />);
    fireEvent.click(screen.getByRole("button", { name: "Open panel" }));
    const dialog = await screen.findByRole("dialog", { name: "Billing Engine DB" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus into the panel on open", async () => {
    render(<Harness kind={kind} />);
    fireEvent.click(screen.getByRole("button", { name: "Open panel" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("keeps Tab inside the panel", async () => {
    render(<Harness kind={kind} />);
    fireEvent.click(screen.getByRole("button", { name: "Open panel" }));
    const dialog = await screen.findByRole("dialog");
    // Land on the last focusable inside, then Tab: it must wrap, not escape.
    const inside = dialog.querySelectorAll("button");
    const last = inside[inside.length - 1] as HTMLElement;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Outside" }));
  });

  it("closes on Escape and returns focus to what opened it", async () => {
    render(<Harness kind={kind} />);
    const trigger = screen.getByRole("button", { name: "Open panel" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
