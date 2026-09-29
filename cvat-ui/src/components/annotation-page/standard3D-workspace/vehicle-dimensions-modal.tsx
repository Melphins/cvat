// Copyright (C) CVAT.ai Corporation
// SPDX-License-Identifier: MIT

import React, { useEffect, useMemo, useState } from 'react';
import Alert from 'antd/lib/alert';
import Checkbox from 'antd/lib/checkbox';
import Modal from 'antd/lib/modal';
import Radio from 'antd/lib/radio';
import Select from 'antd/lib/select';
import Space from 'antd/lib/space';
import Text from 'antd/lib/typography/Text';
import message from 'antd/lib/message';
import { useDispatch, useSelector } from 'react-redux';

import { rememberObject, saveAnnotationsAsync, updateAnnotationsAsync } from 'actions/annotation-actions';
import { CombinedState } from 'reducers';
import { LabelType, ObjectType, ShapeType } from 'cvat-core-wrapper';
import vehiclePresets from 'assets/vehicle-dimensions.json';
import { OPEN_VEHICLE_DIMENSIONS_EVENT, startVehiclePresetDrawing } from './vehicle-dimensions';

interface VehiclePreset {
    id: string;
    category: string;
    manufacturer: string;
    model: string;
    displayName?: string;
    variant: string;
    year: string;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    hasRearViewMirrors: boolean;
}

type ApplyScope = 'current' | 'track';
const VEHICLE_PRESET_PREFERENCES = 'cvat.vehicle-preset-preferences';

function meters(value: number): string {
    return (value / 1000).toFixed(3);
}

function normalizeSearch(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function categoriesForLabel(labelName: string): string[] | null {
    const name = normalizeSearch(labelName);
    if (/motor|scooter|moto|bike|bicycle|moped|xemay|xe2banh|2banh|twowheel/.test(name)) {
        return ['Motorcycle'];
    }
    if (/bus|coach|xekhach/.test(name)) return ['Bus / coach'];
    if (/tractor|trailer|container|daukeo|mooc/.test(name)) return ['Tractor / trailer'];
    if (/truck|pickup|xetai|commercialtruck/.test(name)) return ['Commercial truck'];
    if (/car|sedan|suv|vehicle|oto|xeco|xecon|fourwheel|4wheel/.test(name)) return ['Passenger car'];
    return null;
}

export default function VehicleDimensionsModal(): JSX.Element {
    const dispatch = useDispatch();
    const { states, activatedStateID } = useSelector((state: CombinedState) => state.annotation.annotations);
    const { labels, canvasInstance } = useSelector((state: CombinedState) => ({
        labels: state.annotation.job.labels,
        canvasInstance: state.annotation.canvas.instance,
    }));
    const [visible, setVisible] = useState(false);
    const [clientID, setClientID] = useState<number | null>(null);
    const [presetID, setPresetID] = useState<string | null>(null);
    const [manufacturer, setManufacturer] = useState<string | null>(null);
    const [includeMirrors, setIncludeMirrors] = useState(false);
    const [marginMm, setMarginMm] = useState(10);
    const [scope, setScope] = useState<ApplyScope>('current');
    const [applying, setApplying] = useState(false);
    const cuboidLabels = labels.filter((label) => label.type === LabelType.CUBOID || label.type === 'any');
    const [labelID, setLabelID] = useState<number | null>(cuboidLabels[0]?.id ?? null);

    const objectState = states.find((state) => state.clientID === clientID);
    const preset = (vehiclePresets as VehiclePreset[]).find(({ id }) => id === presetID);
    const isTrack = objectState?.objectType === ObjectType.TRACK;
    const effectiveWidth = preset ? preset.widthMm + (includeMirrors ? 200 : 0) : 0;
    const selectedLabel = cuboidLabels.find((label) => label.id === labelID);
    const selectedCategories = categoriesForLabel(selectedLabel?.name || '');
    const catalogue = useMemo(() => (vehiclePresets as VehiclePreset[]).filter((item) => (
        !selectedCategories || selectedCategories.includes(item.category)
    )), [selectedCategories?.join('|')]);

    const manufacturers = useMemo(() => [...new Set(
        catalogue.map((item) => item.manufacturer),
    )].sort((a, b) => a.localeCompare(b)), [catalogue]);
    const modelOptions = useMemo(() => catalogue
        .filter((item) => !manufacturer || item.manufacturer === manufacturer)
        .map((item) => ({ value: item.id, label: item.displayName || item.model })), [manufacturer, catalogue]);

    // A remembered choice may belong to another label category. Do not leave
    // the user with an apparently selected manufacturer/model that has no
    // matching options after the label type filter is applied.
    useEffect(() => {
        if (manufacturer && !manufacturers.includes(manufacturer)) {
            setManufacturer(null);
            setPresetID(null);
            return;
        }
        if (presetID && !catalogue.some((item) => item.id === presetID && (!manufacturer || item.manufacturer === manufacturer))) {
            setPresetID(null);
        }
    }, [catalogue, manufacturer, manufacturers, presetID]);

    useEffect(() => {
        const onOpen = (event: Event): void => {
            const requestedID = (event as CustomEvent<{ clientID?: number }>).detail?.clientID;
            const hasRequestedObject = Number.isInteger(requestedID);
            const nextID = hasRequestedObject ? requestedID : activatedStateID;
            const nextState = hasRequestedObject ? states.find((state) => state.clientID === nextID) : null;
            if (hasRequestedObject && (!nextState || nextState.shapeType !== ShapeType.CUBOID)) {
                message.warning('Select a 3D cuboid before applying a vehicle size preset');
                return;
            }
            if (nextState?.lock) {
                message.warning('Unlock the cuboid before changing its dimensions');
                return;
            }
            setClientID(nextState ? nextID : null);
            setLabelID(nextState?.label?.id ?? cuboidLabels[0]?.id ?? null);
            let preferences: { manufacturer?: string; presetID?: string; includeMirrors?: boolean; marginMm?: number } = {};
            try {
                preferences = JSON.parse(window.localStorage.getItem(VEHICLE_PRESET_PREFERENCES) || '{}');
            } catch (error) { /* Ignore malformed local preferences. */ }
            setPresetID(preferences.presetID || null);
            setManufacturer(preferences.manufacturer || null);
            setIncludeMirrors(preferences.includeMirrors ?? false);
            setMarginMm(preferences.marginMm ?? 10);
            setScope('current');
            setVisible(true);
        };
        window.addEventListener(OPEN_VEHICLE_DIMENSIONS_EVENT, onOpen);
        return () => window.removeEventListener(OPEN_VEHICLE_DIMENSIONS_EVENT, onOpen);
    }, [activatedStateID, states]);

    useEffect(() => {
        if (labelID === null && cuboidLabels.length) {
            setLabelID(cuboidLabels[0].id);
        }
    }, [cuboidLabels, labelID]);

    const selectPreset = (id: string): void => {
        const selected = (vehiclePresets as VehiclePreset[]).find((item) => item.id === id);
        setPresetID(id);
        setIncludeMirrors(Boolean(selected?.hasRearViewMirrors));
        window.localStorage.setItem(VEHICLE_PRESET_PREFERENCES, JSON.stringify({
            manufacturer, presetID: id, includeMirrors: Boolean(selected?.hasRearViewMirrors), marginMm,
        }));
    };

    const selectManufacturer = (value: string): void => {
        setManufacturer(value);
        setPresetID(null);
        setIncludeMirrors(false);
        window.localStorage.setItem(VEHICLE_PRESET_PREFERENCES, JSON.stringify({ manufacturer: value, marginMm }));
    };

    const apply = async (): Promise<void> => {
        if (!preset) return;
        if (objectState && isTrack && scope === 'track') {
            const confirmed = await new Promise<boolean>((resolve) => {
                Modal.confirm({
                    title: 'Resize entire track?',
                    content: 'This will change the dimensions of every keyframe in this track.',
                    okText: 'Resize track',
                    cancelText: 'Cancel',
                    onOk: () => resolve(true),
                    onCancel: () => resolve(false),
                });
            });
            if (!confirmed) return;
        }
        const dimensions = {
            length: (preset.lengthMm + marginMm) / 1000,
            width: (effectiveWidth + marginMm) / 1000,
            height: (preset.heightMm + marginMm) / 1000,
        };
        window.localStorage.setItem(VEHICLE_PRESET_PREFERENCES, JSON.stringify({
            manufacturer, presetID, includeMirrors, marginMm,
        }));
        setApplying(true);
        try {
            if (!objectState) {
                const label = cuboidLabels.find((item) => item.id === labelID);
                if (!label || !canvasInstance) {
                    message.warning('Choose a cuboid label before drawing');
                    return;
                }
                dispatch(rememberObject({
                    activeObjectType: ObjectType.SHAPE,
                    activeShapeType: ShapeType.CUBOID,
                    activeLabelID: label.id,
                }) as any);
                startVehiclePresetDrawing(dimensions);
                canvasInstance.cancel();
                canvasInstance.draw({ enabled: true, shapeType: ShapeType.CUBOID });
                setVisible(false);
                return;
            }
            if (scope === 'track' && isTrack) {
                await objectState.applyCuboidDimensionsToTrack(dimensions);
                // Track keyframes are changed in the core collection; save the full
                // collection so the server receives every resized keyframe.
                await dispatch(saveAnnotationsAsync() as any);
            } else {
                const points = [...objectState.points];
                const bottom = points[2] - points[8] / 2;
                points[2] = bottom + dimensions.height / 2;
                points[6] = dimensions.length;
                points[7] = dimensions.width;
                points[8] = dimensions.height;
                objectState.points = points;
                await dispatch(updateAnnotationsAsync([objectState]) as any);
            }
            message.success(`Applied ${preset.manufacturer} ${preset.model}: ${dimensions.length.toFixed(3)} × ${dimensions.width.toFixed(3)} × ${dimensions.height.toFixed(3)} m`);
            setVisible(false);
        } catch (error) {
            message.error(`Could not apply vehicle dimensions: ${(error as Error).message}`);
        } finally {
            setApplying(false);
        }
    };

    return (
        <Modal
            open={visible}
            title='Apply Vehicle Dimensions'
            okText='Apply dimensions'
            confirmLoading={applying}
            okButtonProps={{ disabled: !preset }}
            cancelButtonProps={{ disabled: applying }}
            destroyOnClose
            onOk={apply}
            onCancel={(): void => setVisible(false)}
        >
            <Space direction='vertical' size='middle' style={{ width: '100%' }}>
                <Text strong>1. Label type</Text>
                <Select
                    value={labelID}
                    placeholder='Choose vehicle label'
                    options={cuboidLabels.map((label) => ({ value: label.id, label: label.name }))}
                    style={{ width: '100%' }}
                    onChange={(value: number): void => {
                        setLabelID(value);
                        setManufacturer(null);
                        setPresetID(null);
                        setIncludeMirrors(false);
                    }}
                />
                {selectedCategories ? <Text type='secondary'>Vehicle catalogue filtered for this label type</Text> : null}
                {objectState ? <Text type='secondary'>Object #{objectState.clientID} — {objectState.label.name}</Text> : null}
                <Text strong>2. Manufacturer</Text>
                <Select
                    showSearch
                    value={manufacturer}
                    placeholder='Choose manufacturer'
                    optionFilterProp='label'
                    options={manufacturers.map((item) => ({ value: item, label: item }))}
                    style={{ width: '100%' }}
                    onChange={selectManufacturer}
                />
                <Text strong>3. Vehicle model</Text>
                <Select
                    showSearch
                    value={presetID}
                    placeholder='Search vehicle model (e.g. vf3)'
                    optionFilterProp='label'
                    filterOption={(input, option): boolean => normalizeSearch(String(option?.label ?? ''))
                        .includes(normalizeSearch(input))}
                    options={modelOptions}
                    disabled={!manufacturer}
                    style={{ width: '100%' }}
                    onChange={selectPreset}
                />
                {preset ? (
                    <>
                        <Alert
                            type='info'
                            showIcon
                            message={`Manufacturer size: ${meters(preset.lengthMm)} × ${meters(preset.widthMm)} × ${meters(preset.heightMm)} m`}
                            description={`Applied size: ${meters(preset.lengthMm + marginMm)} × ${meters(effectiveWidth + marginMm)} × ${meters(preset.heightMm + marginMm)} m (margin +${marginMm} mm)`}
                        />
                        <Checkbox
                            checked={includeMirrors}
                            onChange={(event): void => setIncludeMirrors(event.target.checked)}
                        >
                            Include rear-view mirrors (+0.200 m total width)
                        </Checkbox>
                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                            <Text strong>Annotation margin</Text>
                            <Select
                                value={marginMm}
                                style={{ width: '100%' }}
                                options={[0, 10, 20].map((value) => ({
                                    value,
                                    label: `+${value} mm per dimension`,
                                }))}
                                onChange={setMarginMm}
                            />
                        </Space>
                    </>
                ) : null}
                {objectState && isTrack ? (
                    <Radio.Group value={scope} onChange={(event): void => setScope(event.target.value)}>
                        <Radio value='current'>Current keyframe</Radio>
                        <Radio value='track'>Entire track (all keyframes)</Radio>
                    </Radio.Group>
                ) : <Text type='secondary'>{objectState ? 'Target: current shape' : 'Target: new cuboid — draw its position on the LiDAR view'}</Text>}
                <Text type='secondary'>The cuboid bottom center and orientation are preserved.</Text>
            </Space>
        </Modal>
    );
}
