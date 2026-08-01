/*
    DiepCustom - custom tank game server that shares diep.io's WebSocket protocol
    Copyright (C) 2022 ABCxFF (github.com/ABCxFF)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>
*/

import ObjectEntity from "./Object";
import Barrel from "./Barrel";

import { BarrelBase } from "./TankBody";
import { Color, InputFlags, PositionFlags, NameFlags, PhysicsFlags, Stat, StyleFlags } from "../src/Const/Enums";
import { BarrelDefinition } from "../src/Const/TankDefinitions";
import { AI, AIState, Inputs } from "./AI";
import { Entity } from "../src/Native/Entity";
import { NameGroup } from "../src/Native/FieldGroups";
import LivingEntity from "./Live";
import { CameraEntity } from "../src/Native/Camera";
import { GuardObject } from "./Addons";

export const AutoTurretDefinition: BarrelDefinition = {
    angle: 0,
    offset: 0,
    size: 87,
    width: 40,
    delay: 0.01,
    reload: 1,
    recoil: 0.3,
    isTrapezoid: false,
    trapezoidDirection: 0,
    addon: null,
    bullet: {
        type: "bullet",
        health: 1,
        damage: 0.3,
        speed: 1.2,
        scatterRate: 1,
        lifeLength: 1,
        sizeRatio: 1,
        absorbtionFactor: 1
    }
}

/**
 * Auto Turret Barrel + Barrel Base
 */
export default class AutoTurret extends ObjectEntity {
    // TODO(ABC):
    // Maybe just remove this
    /** For mounted turret name to show up on Auto Turrets. */
    public nameData: NameGroup = new NameGroup(this);

    /** Barrel's owner (Tank-like object). */
    public owner: BarrelBase;

    /** Actual turret / barrel. */
    public turret: Barrel;

    /** The AI controlling the turret. */
    public ai: AI;

    /** The AI's inputs, for determining whether to shoot or not. */
    public inputs: Inputs;

    /** Camera entity / team of the turret. */
    public cameraEntity: CameraEntity;

    /** If set to true, (auto 5 auto 3), player can influence auto turret's */
    public influencedByOwnerInputs: boolean = false;

    /** The reload time of the turret. */
    public reloadTime = 15;
    /** The size of the auto turret base */
    public baseSize: number;

    public constructor(owner: BarrelBase, turretDefinition: BarrelDefinition = AutoTurretDefinition, baseSize: number = 25) {
        super(owner.game);

        this.owner = owner;
        this.cameraEntity = owner.cameraEntity;

        this.styleData.values.color = turretDefinition.color ?? Color.Barrel;

        this.ai = new AI(this);
        this.ai.doAimPrediction = true;
        this.ai.viewRange = turretDefinition.range || 500;
        this.inputs = this.ai.inputs;

        this.ai.targetFilter = (targetPos) => {
            const { x, y } = this.getWorldPosition();
            const distSq = (targetPos.x - x) ** 2 + (targetPos.y - y) ** 2;
            if (distSq > (this.ai.viewRange ** 2)) return false;

            const parentAngle = this.owner.rootParent.positionData.angle;
            const mountAngle = (this.positionData.values.x === 0 && this.positionData.values.y === 0)
                ? this.turret.definition.angle
                : Math.atan2(this.positionData.values.y, this.positionData.values.x);
            const outwardAngle = parentAngle + mountAngle;

            const angleToTarget = Math.atan2(targetPos.y - y, targetPos.x - x);
            let delta = angleToTarget - outwardAngle;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;

            return Math.abs(delta) <= (Math.PI / 2);
        };
        
        this.setParent(owner);
        this.relationsData.values.owner = owner;
        this.relationsData.values.team = owner.relationsData.values.team;

        this.baseSize = baseSize;
        this.physicsData.values.sides = 1;
        this.physicsData.values.size = this.baseSize * this.owner.rootParent.scaleFactor;

        this.scaleFactor = this.owner.rootParent.scaleFactor;

        if (this.styleData.values.flags & StyleFlags.showsAboveParent) {
            this.styleData.values.flags ^= StyleFlags.showsAboveParent;
        }

        this.positionData.values.flags |= PositionFlags.absoluteRotation;

        this.nameData.values.name = "Mounted Turret";
        this.nameData.values.flags |= NameFlags.hiddenName;

        this.turret = new Barrel(this, turretDefinition);
        this.turret.physicsData.values.flags |= PhysicsFlags.doChildrenCollision;
    }

    /**
     * Called similarly to LivingEntity.onKill
     * Spreads onKill to owner
     */
    public onKill(killedEntity: LivingEntity) {
        (this.owner as unknown as LivingEntity)?.onKill?.(killedEntity);
    }

    public tick(tick: number) {
        if (this.inputs !== this.ai.inputs) this.inputs = this.ai.inputs;

        this.relationsData.values.team = this.owner.relationsData.values.team;

        if (this.ai.state === AIState.hasTarget) this.ai.passiveRotation = Math.random() < .5 ? AI.PASSIVE_ROTATION : -AI.PASSIVE_ROTATION;

        this.ai.aimSpeed = this.turret.bulletAccel;
        // Top Speed
        this.ai.movementSpeed = 0;

        this.reloadTime = this.owner.reloadTime;

        this.turret.calculateStatData();

        let useAI = !(this.influencedByOwnerInputs && (this.owner.inputs.attemptingRepel() || this.owner.inputs.attemptingShot()));

        const parentAngle = this.owner.rootParent.positionData.angle;
        const mountAngle = (this.positionData.values.x === 0 && this.positionData.values.y === 0)
            ? this.turret.definition.angle
            : Math.atan2(this.positionData.values.y, this.positionData.values.x);
        const outwardAngle = parentAngle + mountAngle;

        if (!useAI) {
            const { x, y } = this.getWorldPosition();
            let flip = this.owner.inputs.attemptingRepel() ? -1 : 1;
            const deltaPos = {x: (this.owner.inputs.mouse.x - x) * flip, y: (this.owner.inputs.mouse.y - y) * flip}

            if (this.ai.targetFilter({x: x + deltaPos.x, y: y + deltaPos.y}) === false) useAI = true;
            else {
                this.inputs.flags |= InputFlags.leftclick;
                this.positionData.angle = Math.atan2(deltaPos.y, deltaPos.x);
                this.ai.state = AIState.hasTarget;
            }
        }
        if (useAI) {
            if (this.ai.state === AIState.idle) {
                if (!(this.owner instanceof GuardObject)) {
                    this.positionData.angle += this.ai.passiveRotation;
                }
                this.turret.attemptingShot = false;
            } else {
                const { x, y } = this.getWorldPosition();
                const targetAngle = Math.atan2(this.ai.inputs.mouse.y - y, this.ai.inputs.mouse.x - x);
                let delta = targetAngle - outwardAngle;
                while (delta > Math.PI) delta -= Math.PI * 2;
                while (delta < -Math.PI) delta += Math.PI * 2;
                
                const maxArc = Math.PI / 2;
                const clampedDelta = Math.max(-maxArc, Math.min(maxArc, delta));
                this.positionData.angle = outwardAngle + clampedDelta;
                this.turret.attemptingShot = true;
            }
        } else {
            this.turret.attemptingShot = true;
        }
    }
}
