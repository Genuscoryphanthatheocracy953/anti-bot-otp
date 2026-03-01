export interface PowChallenge {
  nonce: string;
  difficulty: number;
  challenge_id: string;
  created_at: number;
  device_id: string;
}

export interface PowSolution {
  nonce: string;
  solution: string;
  challenge_id: string;
}
