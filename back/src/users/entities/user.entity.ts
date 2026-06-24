export class UserEntity {
  id: string;
  organization_id: string;

  name: string;
  email: string;

  role: string;
  active: boolean;

  created_at?: Date;
  updated_at?: Date;
}
