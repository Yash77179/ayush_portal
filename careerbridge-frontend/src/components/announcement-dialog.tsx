"use client";

/**
 * One announcement opened on its own, over a blurred page: the full message, its event, files, link and "Got it".
 * Students open it from Campus (or a notification); the placement cell opens what it sent, with `aside` for the
 * audience, receipts and actions.
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { AnnouncementCard, type CardData } from "@/components/announcement-card";

export function AnnouncementDialog({
  a,
  from,
  onClose,
  onAck,
  acking,
  aside,
}: {
  a: CardData | null;
  from?: string;
  onClose: () => void;
  onAck?: () => void;
  acking?: boolean;
  aside?: React.ReactNode;
}) {
  // keep the last announcement on screen while the closing animation plays
  const [shown, setShown] = React.useState(a);
  if (a && a !== shown) setShown(a);
  const view = a ?? shown;

  return (
    <DialogPrimitive.Root open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--background)_42%,transparent)] backdrop-blur-[10px] duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[min(40rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.75rem] bg-popover text-popover-foreground shadow-[0_2px_8px_oklch(0.2_0.02_270/0.06),0_40px_90px_-30px_oklch(0.2_0.02_270/0.45)] ring-1 ring-(--hairline) duration-300 ease-(--ease-out) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]"
        >
          {view && (
            <>
              <DialogPrimitive.Title className="sr-only">{view.title}</DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Close"
                className="absolute top-4 right-4 z-10 rounded-full bg-card/80 p-2 text-muted-foreground ring-1 ring-(--hairline) backdrop-blur transition-colors hover:bg-card hover:text-foreground"
              >
                <XIcon className="size-[1.125rem]" />
              </DialogPrimitive.Close>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <AnnouncementCard full a={view} from={from} onAck={onAck} acking={acking} className="rounded-none bg-transparent ring-0" />
              </div>
              {aside && <div className="shrink-0 border-t border-(--hairline) bg-secondary/40 px-6 py-4 sm:px-8">{aside}</div>}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
