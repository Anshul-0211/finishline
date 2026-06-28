export interface Commitment {
  id: string;
  userId: string;
  title: string;
  domain: 'academic' | 'work' | 'personal' | 'health' | 'social' | 'family';
  deadline: any; // Timestamp
  status: 'active' | 'completed' | 'missed' | 'renegotiating' | 'snoozed';
  completionPercentage: number;
  riskScore: number;
  riskTrend: 'improving' | 'stable' | 'worsening';
  priority: 'critical' | 'high' | 'medium' | 'low';
  effortEstimateHours: number;
  scheduledBlocks: any[];
  calendarEventIds: string[];
  hasCollision?: boolean;
  collisionDetails?: string | null;
  actionPlan: any;
  createdAt: any; // Timestamp
}
