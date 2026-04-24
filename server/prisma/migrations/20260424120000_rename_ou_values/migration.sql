-- Remap legacy User.ou values to the canonical 2026 OU list.
-- Any values not listed below (including NULL) are left untouched.

UPDATE "User" SET "ou" = 'AMER TMT & CBS'          WHERE "ou" = 'AMER ACC';
UPDATE "User" SET "ou" = 'AMER PACE & AFD360 OU'   WHERE "ou" = 'AMER PACE';
UPDATE "User" SET "ou" = 'EMEA Central'            WHERE "ou" = 'EMEA CENTRAL';
UPDATE "User" SET "ou" = 'EMEA North'              WHERE "ou" = 'EMEA NORTH';
UPDATE "User" SET "ou" = 'EMEA South'              WHERE "ou" = 'EMEA SOUTH';
UPDATE "User" SET "ou" = 'France'                  WHERE "ou" = 'FRANCE';
UPDATE "User" SET "ou" = 'GPS .Org'                WHERE "ou" = 'GLOBAL PUBSEC';
UPDATE "User" SET "ou" = 'Global SMB (incl. EBOU)' WHERE "ou" = 'GLOBAL SMB';
UPDATE "User" SET "ou" = 'Data Foundation'         WHERE "ou" = 'NEXTGEN PLATFORM';
UPDATE "User" SET "ou" = 'South Asia'              WHERE "ou" = 'SOUTH ASIA';
UPDATE "User" SET "ou" = NULL                      WHERE "ou" = 'JAPAN / KOREA / TAIWAN';
