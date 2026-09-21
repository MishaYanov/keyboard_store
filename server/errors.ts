export class HttpError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown error';
