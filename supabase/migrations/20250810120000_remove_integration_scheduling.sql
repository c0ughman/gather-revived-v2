-- Remove integration scheduling functionality
-- Drop scheduling-related columns from agent_integrations table

-- Remove the trigger_type index first
DROP INDEX IF EXISTS idx_agent_integrations_trigger;

-- Remove the scheduling columns
ALTER TABLE agent_integrations 
DROP COLUMN IF EXISTS trigger_type,
DROP COLUMN IF EXISTS interval_minutes;

-- Update any remaining references or constraints if needed
-- (No additional constraints to remove in this case)