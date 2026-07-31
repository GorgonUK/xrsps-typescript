import { sendWidgetDrag } from "../../../network/ServerConnection";
import type { ScriptEvent } from "../../../rs/cs2/Cs2Vm";
import { resolveDynamicWidgetParentId } from "../widgetActionPayload";
import type { WidgetInputControllerDeps, WidgetInputFrame } from "./widgetInputTypes";
import type { WidgetInteractionController } from "../WidgetInteractionController";
import type { WidgetManager } from "../../../widgets/WidgetManager";

export function processWidgetReleaseInput(
    deps: WidgetInputControllerDeps,
    frame: WidgetInputFrame,
    widgetManager: WidgetManager,
    widgetInteraction: WidgetInteractionController,
    getPrimaryWidgetAction: (w: any) => import("./widgetPrimaryAction").PrimaryWidgetAction,
    isHolding: boolean,
): void {
    const { mx, my } = frame;
    // Release
    if (widgetInteraction.clickedWidget && !isHolding) {
        // Drag complete
        if (widgetInteraction.isDraggingWidget) {
            const w = widgetInteraction.clickedWidget;
            // Use draggedOnWidget tracked during drag ()
            const dragTarget = widgetInteraction.draggedOnWidget;
            // Ensure clickedWidgetParent is resolved for final clamp/coords.
            if (!widgetInteraction.clickedWidgetParent) {
                widgetInteraction.clickedWidgetParent = widgetInteraction.resolveClickedWidgetParent(w);
            }
            const renderArea = widgetInteraction.clickedWidgetParent;
            const hasExplicitDragParent = renderArea !== null;

            const widgetWidth = w.width ?? 0;
            const widgetHeight = w.height ?? 0;
            const [renderScaleX, renderScaleY] = widgetInteraction.getUiRenderScale();

            let targetAbsX = mx - widgetInteraction.clickedWidgetX;
            let targetAbsY = my - widgetInteraction.clickedWidgetY;

            // Only clamp to parent bounds if there's an explicit drag parent
            let parentAbsX = 0;
            let parentAbsY = 0;
            let parentScrollX = 0;
            let parentScrollY = 0;

            if (hasExplicitDragParent) {
                parentAbsX = renderArea._absX ?? widgetInteraction.dragRenderAreaAbsX ?? 0;
                parentAbsY = renderArea._absY ?? widgetInteraction.dragRenderAreaAbsY ?? 0;
                const parentWidth = renderArea.width ?? 0;
                const parentHeight = renderArea.height ?? 0;
                parentScrollX = renderArea.scrollX ?? 0;
                parentScrollY = renderArea.scrollY ?? 0;

                // Scale logical dimensions to pixel space for consistent clamping
                const widgetPixelW = widgetWidth * renderScaleX;
                const widgetPixelH = widgetHeight * renderScaleY;
                const parentPixelW = parentWidth * renderScaleX;
                const parentPixelH = parentHeight * renderScaleY;
                if (targetAbsX < parentAbsX) targetAbsX = parentAbsX;
                if (targetAbsX + widgetPixelW > parentAbsX + parentPixelW)
                    targetAbsX = parentAbsX + parentPixelW - widgetPixelW;
                if (targetAbsY < parentAbsY) targetAbsY = parentAbsY;
                if (targetAbsY + widgetPixelH > parentAbsY + parentPixelH)
                    targetAbsY = parentAbsY + parentPixelH - widgetPixelH;
            }

            // Convert pixel-space difference to logical coordinates for CS2 scripts
            const scriptX = ((targetAbsX - parentAbsX) / renderScaleX + parentScrollX) | 0;
            const scriptY = ((targetAbsY - parentAbsY) / renderScaleY + parentScrollY) | 0;

            const dragCompleteCtx: Partial<ScriptEvent> = {
                mouseX: scriptX,
                mouseY: scriptY,
                dragTarget,
            };

            if (w.eventHandlers?.onDragComplete) {
                deps.getCs2Vm().invokeEventHandler(w, "onDragComplete", dragCompleteCtx);
            } else if (w.onDragComplete) {
                deps.executeScriptListener(w, w.onDragComplete, dragCompleteCtx);
            }

            // Handle inventory slot drag-drop
            // Check if source is an inventory slot (group 149)
            const sourceGroupId = (w.uid >>> 16) & 0xffff;
            const sourceSlot = (w as any).childIndex ?? -1;

            if (sourceGroupId === 149 && sourceSlot >= 0) {
                // Prefer OSRS-style targeting via draggedOnWidget (destination slot widget).
                const targetSlotFromWidget = (dragTarget as any)?.childIndex;
                const targetGroupId = dragTarget ? (dragTarget.uid >>> 16) & 0xffff : -1;
                if (
                    typeof targetSlotFromWidget === "number" &&
                    targetGroupId === 149 &&
                    targetSlotFromWidget >= 0 &&
                    targetSlotFromWidget < 28
                ) {
                    const targetSlot = targetSlotFromWidget | 0;
                    if (targetSlot !== sourceSlot) {
                        deps.handleInventorySlotMove(sourceSlot, targetSlot);
                    }
                } else {
                    // Fallback: derive slot from mouse position (legacy behaviour, less accurate).
                    const invContainer = widgetManager.getWidgetByUid(9764864); // 149 << 16
                    const firstSlot = invContainer?.children?.[0];
                    if (
                        invContainer &&
                        firstSlot &&
                        invContainer._absX !== undefined &&
                        invContainer._absY !== undefined
                    ) {
                        const gridOriginX = invContainer._absX + (firstSlot.x || 0);
                        const gridOriginY = invContainer._absY + (firstSlot.y || 0);
                        const relX = mx - gridOriginX;
                        const relY = my - gridOriginY;
                        const slotWidth = 42; // 36px slot + 6px gap
                        const slotHeight = 36; // 32px slot + 4px gap
                        const cols = 4;
                        const rows = 7;

                        const col = Math.floor(relX / slotWidth);
                        const row = Math.floor(relY / slotHeight);

                        if (col >= 0 && col < cols && row >= 0 && row < rows) {
                            const targetSlot = row * cols + col;
                            if (
                                targetSlot !== sourceSlot &&
                                targetSlot >= 0 &&
                                targetSlot < 28
                            ) {
                                deps.handleInventorySlotMove(sourceSlot, targetSlot);
                            }
                        }
                    }
                }
            } else if (dragTarget != null) {
                // Non-inventory drag-drop - send IF_BUTTOND packet
                // For dynamically created children (fileId === -1),
                // send the PARENT container's UID, not the child's own UID.
                // The childIndex is the slot within the container.
                const resolvedSourceParent =
                    (w as any).fileId === -1 ? resolveDynamicWidgetParentId(widgetManager, w) : undefined;
                const resolvedTargetParent =
                    (dragTarget as any).fileId === -1
                        ? resolveDynamicWidgetParentId(widgetManager, dragTarget)
                        : undefined;
                const sourceWidgetId =
                    (w as any).fileId === -1 ? (resolvedSourceParent ?? w.uid) : w.uid;
                const targetWidgetId =
                    (dragTarget as any).fileId === -1
                        ? (resolvedTargetParent ?? dragTarget.uid)
                        : dragTarget.uid;

                const targetSlot = (dragTarget as any).childIndex ?? -1;
                const sourceItemId = (w as any).itemId ?? -1;
                const targetItemId = (dragTarget as any).itemId ?? -1;

                // Send IF_BUTTOND packet for widget drag operations (bank, etc.)
                sendWidgetDrag(
                    sourceWidgetId,
                    sourceSlot,
                    sourceItemId,
                    targetWidgetId,
                    targetSlot,
                    targetItemId,
                );
            }

            // Clear deferred action - drag completed so we don't want the "Use" action
            widgetInteraction.deferredWidgetAction = null;

            widgetInteraction.dragSourceWidget = null; // Clear legacy tracker
            widgetInteraction.isDraggingWidget = false;
            widgetInteraction.draggedOnWidget = null;
            widgetInteraction.clickedWidgetParent = null;
            delete widgetInteraction.dragRenderAreaAbsX;
            delete widgetInteraction.dragRenderAreaAbsY;
            if ((w as any)._dragPickupOffsetX !== undefined)
                delete (w as any)._dragPickupOffsetX;
            if ((w as any)._dragPickupOffsetY !== undefined)
                delete (w as any)._dragPickupOffsetY;
            // Clear drag visual state
            delete (w as any)._dragVisualX;
            delete (w as any)._dragVisualY;
            delete (w as any)._dragAbsX;
            delete (w as any)._dragAbsY;
            delete (w as any)._isDragActive;
        } else {
            // Mouse button released without dragging - fire onClick (for draggable widgets) and onRelease
            const releaseCtx: Partial<ScriptEvent> = {
                mouseX: mx - (widgetInteraction.clickedWidget._absX ?? widgetInteraction.clickedWidget.x ?? 0),
                mouseY: my - (widgetInteraction.clickedWidget._absY ?? widgetInteraction.clickedWidget.y ?? 0),
                opIndex: 1,
            };

            // For draggable widgets, onClick fires on release (not mousedown)
            // Check if this was a draggable widget that we deferred onClick for
            if (widgetInteraction.isWidgetDraggable(widgetInteraction.clickedWidget)) {
                const { option, target, slot, itemId, opIndex } = getPrimaryWidgetAction(
                    widgetInteraction.clickedWidget,
                );
                deps.handleWidgetAction({
                    widget: widgetInteraction.clickedWidget,
                    option,
                    target,
                    source: "primary",
                    cursorX: releaseCtx.mouseX,
                    cursorY: releaseCtx.mouseY,
                    slot,
                    itemId,
                    opIndex,
                });
            }

            // Fire onRelease
            if (widgetInteraction.clickedWidget.eventHandlers?.onRelease) {
                deps.getCs2Vm().invokeEventHandler(widgetInteraction.clickedWidget, "onRelease", releaseCtx);
            } else if (widgetInteraction.clickedWidget.onRelease) {
                deps.executeScriptListener(
                    widgetInteraction.clickedWidget,
                    widgetInteraction.clickedWidget.onRelease,
                    releaseCtx,
                );
            }
        }

        widgetInteraction.clickedWidget = null;
        widgetInteraction.clickedWidgetParent = null;
        widgetInteraction.clickedWidgetHandled = false;
        widgetInteraction.widgetDragDuration = 0;

        // Process deferred widget action on mouse release (if no drag occurred)
        if (widgetInteraction.deferredWidgetAction && !widgetInteraction.isDraggingWidget) {
            const deferredEvent = widgetInteraction.deferredWidgetAction;
            widgetInteraction.deferredWidgetAction = null;
            // Re-call handleWidgetAction - mouse is now released so it will process
            deps.handleWidgetAction(deferredEvent);
        } else {
            // Clear deferred action if drag occurred
            widgetInteraction.deferredWidgetAction = null;
        }
    }
}
