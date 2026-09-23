-- Public admission requires an exact Part XI type. Existing generic rows must be
-- explicitly refused/reviewed before this constraint can be applied. No coercion.
ALTER TABLE "EnergyObservation" ADD CONSTRAINT "EnergyObservation_public_subject_type"
CHECK (NOT ("admission" = 'ADMITTED' AND "publicDisclosureApproved") OR
 COALESCE("payload"->>'subjectType' IN ('SUPPLY_SITUATION', 'CORRIDOR', 'INFRASTRUCTURE_ASSET', 'GRID_SITUATION'), false));
