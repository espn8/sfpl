-- Add TEAM visibility option for OU-based sharing
-- Now supports three visibility levels: PUBLIC, TEAM (same OU), PRIVATE (owner only)
ALTER TYPE "PromptVisibility" ADD VALUE 'TEAM';
