export function publicRegistrationEnabled(env = process.env) {
    return env.ALLOW_PUBLIC_REGISTRATION === 'true';
}
