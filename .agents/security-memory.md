# Security Memory - Access Control Documentation

## resumo_semanal_pendentes

- **Classification**: Admin-only (Global Trust Model).
- **Data Sensitivity**: High (Contains phone numbers and financial values/consolidated ZN/ZS values).
- **Access Policy**:
    - **SELECT**: Restricted to `admin` role via `has_role(auth.uid(), 'admin'::app_role)`.
    - **INSERT/UPDATE/DELETE**: Explicitly denied for `anon` and `authenticated` roles via RESTRICTIVE policies (likely managed by Edge Functions/Service Role).
- **Finding Analysis**: The table does not have a `unidade_id` column.
- **Decision**: In the current system model, `admin` (and potentially `master_admin` if mapped to the same enum value) are considered global trust profiles. Therefore, global visibility for these roles is intentional.
- **Mitigation/Future Recommendation**: If the system moves towards unit-specific admin roles in the future, the following steps will be required:
    1. Add `unidade_id` column to `resumo_semanal_pendentes`.
    2. Migrate existing data to assign correct unit IDs.
    3. Update data generation logic (Edge Functions/Jobs) to populate `unidade_id`.
    4. Refine SELECT policy to validate unit scope: `unidade_id IN (SELECT get_user_unidades(auth.uid()))`.
    5. Maintain global access only for `master_admin` (if applicable).
