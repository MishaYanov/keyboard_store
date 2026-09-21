/** One key per logical attempt, retained when the response is uncertain. */
export class CheckoutAttempt {
    private fingerprint = '';
    private key: string | null = null;
    public constructor(private readonly createKey = () => crypto.randomUUID()) {}
    public forPayload(payload: string): string {
        if (payload !== this.fingerprint || !this.key) {
            this.fingerprint = payload;
            this.key = this.createKey();
        }
        return this.key;
    }
    public reset(): void { this.key = null; this.fingerprint = ''; }
}
