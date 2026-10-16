-- Super Admin singleton: tizimda faqat BITTA SUPER_ADMIN bo'lishi mumkin.
-- Trigger prisma schema'da aks ettirilmaydi, lekin har bir muhit uchun bir
-- marta tatbiq qilinadi. Qayta chaqirsa idempotent (DROP + CREATE).

CREATE OR REPLACE FUNCTION enforce_super_admin_singleton()
RETURNS TRIGGER AS $$
DECLARE
  super_role_id UUID;
  other_count INT;
BEGIN
  SELECT id INTO super_role_id FROM roles WHERE slug = 'SUPER_ADMIN';
  IF NEW.role_id = super_role_id THEN
    SELECT COUNT(*) INTO other_count FROM user_roles
      WHERE role_id = super_role_id AND user_id != NEW.user_id;
    IF other_count > 0 THEN
      RAISE EXCEPTION 'Only one SUPER_ADMIN is allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_roles_super_admin_singleton_trigger ON user_roles;
CREATE TRIGGER user_roles_super_admin_singleton_trigger
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION enforce_super_admin_singleton();
