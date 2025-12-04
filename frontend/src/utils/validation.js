export function isEmail(v){ return !!v && /\S+@\S+\.\S+/.test(v); }
export function isStrongPassword(p){ return !!p && p.length >= 8; }
