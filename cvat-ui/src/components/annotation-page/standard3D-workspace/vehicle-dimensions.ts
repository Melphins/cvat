export const OPEN_VEHICLE_DIMENSIONS_EVENT = 'cvat:open-vehicle-dimensions';
export const VEHICLE_DRAW_PRESET_EVENT = 'cvat:vehicle-draw-preset';

export function openVehicleDimensions(clientID?: number): void {
    window.dispatchEvent(new CustomEvent(OPEN_VEHICLE_DIMENSIONS_EVENT, { detail: { clientID } }));
}

export function startVehiclePresetDrawing(dimensions: { length: number; width: number; height: number }): void {
    window.dispatchEvent(new CustomEvent(VEHICLE_DRAW_PRESET_EVENT, { detail: dimensions }));
}
