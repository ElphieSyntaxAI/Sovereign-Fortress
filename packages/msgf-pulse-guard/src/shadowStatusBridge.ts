/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Bridge so Safe Build / Run Scripts can update the MSGF shadow stoplight.
 */
export type MsgfShadowState = "pending" | "green" | "red" | null;

type ShadowApplier = (state: MsgfShadowState, detail?: string) => void;

let applier: ShadowApplier | null = null;

export function registerMsgfShadowApplier(fn: ShadowApplier | null): void {
  applier = fn;
}

export function setMsgfShadowStatus(state: MsgfShadowState, detail?: string): void {
  applier?.(state, detail);
}
