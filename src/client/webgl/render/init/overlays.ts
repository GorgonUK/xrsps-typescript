import Denque from "denque";
import { mat4, vec2, vec3, vec4 } from "gl-matrix";
import { button, folder } from "leva";
import { Schema } from "leva/dist/declarations/src/types";
import {
    DrawCall,
    Framebuffer,
    App as PicoApp,
    PicoGL,
    Program,
    Renderbuffer,
    Texture,
    Timer,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";

import {
    getClientCycle,
    getCurrentTick,
    getServerTickPhaseNow,
    isServerConnected,
    sendEmote,
    sendInteractFollow,
    sendInteractStop,
    subscribeTick,
} from "../../network/ServerConnection";
import { sendLogin } from "../../network/ServerConnection";
import { flushPackets } from "../../network/packet";
import { createTextureArray } from "../../picogl/PicoTexture";
import { RS_TO_RADIANS } from "../../rs/MathConstants";
import { CollisionFlag } from "../../shared/CollisionFlag";
import { isInWilderness } from "../../shared/world/Wilderness";
import {
    getWorldLocChanges,
    getWorldLocSpawns,
    getWorldTerrainOverrides,
} from "../../shared/gamemode/GamemodeContentStore";
import { OsrsMenuEntry } from "../../rs/MenuEntry";
import { MenuTargetType } from "../../rs/MenuEntry";
import type { OverlayFloorType } from "../../rs/config/floortype/OverlayFloorType";
import { LocModelLoader } from "../../rs/config/loctype/LocModelLoader";
import { LocModelType } from "../../rs/config/loctype/LocModelType";
import { NpcModelLoader } from "../../rs/config/npctype/NpcModelLoader";
import { NpcDrawPriority, NpcType } from "../../rs/config/npctype/NpcType";
import { PlayerAppearance } from "../../rs/config/player/PlayerAppearance";
import { PlayerModelLoader } from "../../rs/config/player/PlayerModelLoader";
import { decodeInteractionIndex } from "../../rs/interaction/InteractionIndex";
import { getMapIndexFromTile, getMapPlaneId, getMapSquareId } from "../../rs/map/MapFileIndex";
import { Model } from "../../rs/model/Model";
import { ModelData } from "../../rs/model/ModelData";
import { Scene } from "../../rs/scene/Scene";
import { getUiScale } from "../../ui/UiScale";
import { ClickCrossOverlay } from "../../ui/devoverlay/ClickCrossOverlay";
import { GroundItemOverlay } from "../../ui/devoverlay/GroundItemOverlay";
import { HealthBarOverlay } from "../../ui/devoverlay/HealthBarOverlay";
import { HitsplatOverlay } from "../../ui/devoverlay/HitsplatOverlay";
import {
    InteractHighlightDrawTarget,
    InteractHighlightOverlay,
} from "../../ui/devoverlay/InteractHighlightOverlay";
import { LoadingMessageOverlay } from "../../ui/devoverlay/LoadingMessageOverlay";
import { LoginOverlay } from "../../ui/devoverlay/LoginOverlay";
import { OverheadPrayerOverlay } from "../../ui/devoverlay/OverheadPrayerOverlay";
import { OverheadTextOverlay } from "../../ui/devoverlay/OverheadTextOverlay";
import {
    HealthBarEntry,
    HitsplatEntry,
    OverheadPrayerEntry,
    OverheadTextEntry,
    type OverlayUpdateArgs,
    RenderPhase,
} from "../../ui/devoverlay/Overlay";
import { OverlayManager } from "../../ui/devoverlay/OverlayManager";
import type { TileMarkerOverlay } from "../../ui/devoverlay/TileMarkerOverlay";
import { TileTextOverlay } from "../../ui/devoverlay/TileTextOverlay";
import { WidgetsOverlay } from "../../ui/devoverlay/WidgetsOverlay";
import { MENU_ACTION_DEPRIORITIZE_OFFSET, MenuAction, menuAction } from "../../ui/menu/MenuAction";
import { worldEntriesToSimple } from "../../ui/menu/MenuBridge";
import type { MenuClickContext, SimpleMenuEntry } from "../../ui/menu/MenuEngine";
import { chooseDefaultMenuEntry, shouldLeftClickOpenMenu } from "../../ui/menu/MenuEngine";
import { MenuOpcode } from "../../ui/menu/MenuState";
import { Model2DRenderer } from "../../ui/model/Model2DRenderer";
import {
    canTargetGroundItem,
    canTargetNpc,
    canTargetObject,
    canTargetPlayer,
} from "../../ui/widgets/WidgetFlags";
import { WidgetLoader } from "../../ui/widgets/WidgetLoader";
import { WidgetManager } from "../../ui/widgets/WidgetManager";
import { layoutWidgets } from "../../ui/widgets/layout/WidgetLayout";
import { collectWidgetsAtPoint } from "../../ui/widgets/menu/utils";
import {
    getCanvasCssSize,
    isIos,
    isMobileMode,
    isTouchDevice,
    isWebGL2Supported,
} from "../../util/DeviceUtil";
import { clamp } from "../../util/MathUtil";
import { ClientState } from "../ClientState";
import { GameRenderer } from "../GameRenderer";
import type { HitsplatEventPayload } from "../GameRenderer";
import { OsrsRendererType, WEBGL } from "../GameRenderers";
import { ClickMode, getMousePos } from "../InputManager";
import { OsrsClient } from "../OsrsClient";
import { ActorAnimationClip } from "../actor/ActorAnimation";
import {
    ActorHealthBarsState,
    ActorHitsplatState,
    HealthBarBarState,
    HealthBarDefinitionState,
    HealthBarUpdateState,
    MAX_HITSPLAT_SLOTS,
    createActorHealthBarsState,
    createActorHitsplatState,
} from "../actor/ActorOverlayState";
import type { ClientGroundItemStack, GroundItemOverlayEntry } from "../data/ground/GroundItemStore";
import { NpcEcs } from "../ecs/NpcEcs";
import type { PlayerAnimKey } from "../ecs/PlayerEcs";
import { GameState, LoginIndex } from "../login";
import { Ray, rayIntersectsBox } from "../math/Raycast";
import { isMouseInUIRegion as checkMouseInUIRegion } from "../menu/WorldMenuBuilder";
import {
    advanceAnimation,
    computeMovementOrientation,
    computeMovementStep,
    interpolateRotation,
    parseInteractionTarget,
} from "../movement/NpcClientTick";
import type { TileMarkersPluginConfig } from "../plugins/tilemarkers/types";
import { computeRoofPlaneLimit } from "../roof/RoofVisibility";
import { sampleBridgeHeightForWorldTile } from "../scene/BridgeHeightSampler";
import {
    BridgePlaneStrategy,
    resolveBridgePromotedPlane,
    resolveCollisionSamplePlaneForLocal,
    resolveCollisionSamplePlaneForWorldTile,
    resolveGroundItemStackPlane,
    resolveHeightSamplePlaneForLocal,
    resolveInteractionPlaneForLocal,
    resolveInteractionPlaneForWorldTile,
} from "../scene/PlaneResolver";
import { SceneRaycastHit, SceneRaycaster } from "../scene/SceneRaycaster";
import {
    TILE_FLAG_BRIDGE,
    getTileRenderFlagAt as lookupTileRenderFlagAt,
} from "../scene/TileRenderFlags";
import { LoadingRequirement } from "../state/LoadingTracker";
import type { PlayerSpotAnimationEvent } from "../sync/PlayerSyncTypes";
import { RAD_TO_RS_UNITS, computeFacingRotation } from "../utils/rotation";
import { AnimationFrames } from "../AnimationFrames";
import { ChatheadFactory } from "../ChatheadFactory";
import { type DrawBackend, createDrawBackend } from "../DrawBackend";
import { DrawRange, NULL_DRAW_RANGE, newDrawRange } from "../DrawRange";
import { InteractType } from "../InteractType";
import { profiler } from "../PerformanceProfiler";
import { PlayerChatheadFactory } from "../PlayerChatheadFactory";
import { resolveFogRange } from "../RenderDistancePolicy";
import { WebGLMapSquare } from "../WebGLMapSquare";
import { WorldEntityAnimator } from "../WorldEntityAnimator";
import { SceneBuffer } from "../buffer/SceneBuffer";
import { getModelFaces, isModelFaceTransparent } from "../buffer/SceneBuffer";
import { GfxManager } from "../gfx/GfxManager";
import { GfxRenderer } from "../gfx/GfxRenderer";
import { buildGroundItemGeometry } from "../ground/GroundItemMeshBuilder";
import { type MinimapIcon, SdMapData } from "../loader/SdMapData";
import { SdMapDataLoader } from "../loader/SdMapDataLoader";
import { SdMapLoaderInput } from "../loader/SdMapLoaderInput";
import { isDoorLocType } from "../loc/SceneLocs";
import {
    DynamicNpcAnimLoader,
    DynamicNpcFrameGeometry,
    DynamicNpcSequenceMeta,
} from "../npc/DynamicNpcAnimLoader";
import { PlayerRenderer } from "../player/PlayerRenderer";
import { ProjectileManager } from "../projectiles/ProjectileManager";
import { ProjectileRenderer } from "../projectiles/ProjectileRenderer";
import {
    FRAME_FXAA_PROGRAM,
    FRAME_PROGRAM,
    createMainProgram,
    createNpcProgram,
    createPlayerProgram,
    createProjectileProgram,
} from "../shaders/Shaders";
import { KNOWN_WATER_TEXTURE_IDS } from "../water/WaterTextureIds";
import type { WebGLOsrsRendererHost } from "../../hostInterface";
import { RENDER_CONSTANTS } from "../../constants";

export function initOverlays(host: WebGLOsrsRendererHost, ): void {

        if (!host.app || !host.sceneUniformBuffer) return;
        const initArgs = { app: host.app, sceneUniforms: host.sceneUniformBuffer };
        try {
            host.hitsplatOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init hitsplat overlay", e);
        }
        try {
            host.healthBarOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init health bar overlay", e);
        }
        try {
            host.overheadTextOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init overhead text overlay", e);
        }
        try {
            host.overheadPrayerOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init overhead prayer overlay", e);
        }
        try {
            host.clickCrossOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init click cross overlay", e);
        }
        try {
            host.tileTextOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init tile text overlay", e);
        }
        try {
            host.groundItemOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init ground item overlay", e);
        }
        try {
            host.interactHighlightOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init interact highlight overlay", e);
        }
        try {
            host.objectIdOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init object id overlay", e);
        }
        try {
            host.widgetsOverlay?.init(initArgs);
        } catch (e) {
            console.warn("Failed to init widgets overlay", e);
        }
        // Initialize ItemIconRenderer if loaders are now available
        try {
            const objLoader = host.osrsClient.objTypeLoader;
            const modelLoader = host.osrsClient.modelLoader;
            const textureLoader = host.osrsClient.textureLoader;
            if (objLoader && modelLoader && textureLoader && !host.itemIconRenderer) {
                import("../../ui/item/ItemIconRenderer").then(({ ItemIconRenderer }) => {
                    if (!host.itemIconRenderer) {
                        host.itemIconRenderer = new ItemIconRenderer(
                            objLoader,
                            modelLoader,
                            textureLoader,
                            host.osrsClient.cacheSystem,
                        );
                    }
                });
            }
        } catch (e) {
            console.warn("Failed to init item icon renderer", e);
        }
    
}
