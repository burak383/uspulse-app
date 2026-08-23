import { customAlphabet, nanoid } from 'nanoid';

export const newId = (): string => nanoid();

const inviteAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
export const newInviteCode = customAlphabet(inviteAlphabet, 6);

export const newResetCode = customAlphabet('0123456789', 6);

export const today = (): string => new Date().toISOString().slice(0, 10);

export const isoNow = (): string => new Date().toISOString();
