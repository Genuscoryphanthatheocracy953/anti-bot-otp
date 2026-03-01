export interface AttestationChallenge {
  challenge: string;
  device_id: string;
  created_at: number;
}

export interface AttestationVerifyRequest {
  device_id: string;
  challenge: string;
  signed_response: string;
  public_key: string;
  app_id: string;
}
