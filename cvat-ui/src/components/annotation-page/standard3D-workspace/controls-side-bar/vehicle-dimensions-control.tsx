// Copyright (C) CVAT.ai Corporation
// SPDX-License-Identifier: MIT

import React from 'react';
import { CarOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';

import CVATTooltip from 'components/common/cvat-tooltip';
import { CombinedState } from 'reducers';
import { LabelType } from 'cvat-core-wrapper';
import { openVehicleDimensions } from '../vehicle-dimensions';

export default function VehicleDimensionsControl(): JSX.Element {
    const disabled = useSelector((state: CombinedState) => (
        !state.annotation.job.labels.some((label) => label.type === LabelType.CUBOID || label.type === 'any')
    ));

    return (
        <CVATTooltip title='Vehicle Size Preset' placement='right'>
            <CarOutlined
                className={disabled ? 'cvat-disabled-canvas-control' : 'cvat-vehicle-dimensions-control'}
                onClick={disabled ? undefined : (): void => openVehicleDimensions()}
            />
        </CVATTooltip>
    );
}
