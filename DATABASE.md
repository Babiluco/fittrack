# FitTrack Database

This document describes the initial Supabase database architecture for FitTrack.

Important: LocalStorage remains the current source of truth until a future synchronization sprint. This schema prepares the cloud data layer only. It does not migrate, upload, delete, or rewrite existing local FitTrack data.

## Migration

The reproducible SQL migration is:

As migrations devem estar na pasta:

`supabase/migrations/`

Arquivos esperados:

`001_initial_schema.sql`

`002_profile_fields.sql`

Se essa pasta não existir no projeto baixado, copie as migrations usadas no Supabase para o repositório antes de tentar recriar o banco.

## Ownership Model

Supabase Auth owns identity through `auth.users.id`.

Every user-owned table stores or derives ownership from that id:

- `profiles.id = auth.users.id`
- `workouts.user_id = auth.users.id`
- `measurements.user_id = auth.users.id`
- `goals.user_id = auth.users.id`
- `workout_exercises` inherits ownership from `workouts`
- `workout_sets` inherits ownership from `workout_exercises -> workouts`

The frontend publishable key is expected. Authorization is enforced by database Row Level Security, not by client-side flags.

## Tables

`profiles`

Application-level user profile data only. Email and password remain managed by Supabase Auth.

Profile preferences persisted in Supabase:

- `display_name`
- `height_cm`
- `weight_kg`
- `start_weight_kg`
- `goal`
- `available_days`
- `avg_workout_time`
- `theme`

Fields:

- `id uuid primary key references auth.users(id)`
- `display_name text`
- `avatar_url text`
- `created_at timestamptz`
- `updated_at timestamptz`

`exercises`

Prepared catalog table for future sync. FitTrack currently has a local JavaScript exercise library with string keys like `ex_supino`. The cloud schema keeps a UUID primary key and optional `app_key` for mapping system exercises later.

System exercises are shared. Custom exercises must belong to a user via `user_id`.

Workout history does not depend on this table for display because `workout_exercises.exercise_name` preserves the historical name.

`workouts`

Completed workout session summary.

Separates:

- `total_load`: sum of actual loads used across sets
- `total_reps`: sum of repetitions
- `training_volume`: conventional `sum(weight * reps)`

`training_volume` must not be presented as actual weight.

`workout_exercises`

Child records for exercises performed in a workout. `exercise_name` is required to preserve historical display even if a catalog exercise is renamed later. `exercise_id` is nullable.

`workout_sets`

Primary set data:

- `weight`
- `reps`
- `completed`

The table does not store per-set derived volume as source of truth. Volume can be calculated from `weight * reps`.

`measurements`

Body measurement foundation. Only `user_id` and `recorded_at` are required. All actual measurement values are nullable.

`goals`

Simple user goal foundation. Complex goal logic is intentionally out of scope.

## Relationships

- `auth.users 1 -> 1 profiles`
- `auth.users 1 -> many workouts`
- `workouts 1 -> many workout_exercises`
- `workout_exercises 1 -> many workout_sets`
- `auth.users 1 -> many measurements`
- `auth.users 1 -> many goals`
- `auth.users 1 -> many custom exercises`
- `exercises 1 -> many workout_exercises`, optional

Workout children use `ON DELETE CASCADE` from workout to exercises to sets.

## RLS Policies

RLS is enabled on:

- `profiles`
- `exercises`
- `workouts`
- `workout_exercises`
- `workout_sets`
- `measurements`
- `goals`

Direct user-owned tables use:

`user_id = auth.uid()`

or, for profiles:

`id = auth.uid()`

Child tables use `exists` checks against their parent workout ownership.

Users can only select, insert, update, and delete their own records. For child tables, they can only act when the parent chain belongs to them.

`exercises` has special handling:

- authenticated users can read system exercises
- users can create/update/delete only their own custom exercises
- users cannot create system exercises from the public client

## Profile Creation

The migration creates `public.handle_new_user_profile()`.

It runs after insert on `auth.users` and creates a matching `profiles` row using the signup metadata `name` or `display_name`.

The trigger is intentionally minimal. If profile creation fails, the transaction fails rather than silently pretending the profile exists.

## Indexes

Created indexes:

- `exercises(user_id)`
- unique system `exercises(app_key)`
- `workouts(user_id)`
- `workouts(user_id, completed_at desc)`
- `workout_exercises(workout_id)`
- `workout_exercises(exercise_id)`
- `workout_sets(workout_exercise_id)`
- `measurements(user_id, recorded_at desc)`
- `goals(user_id)`
- `goals(user_id, status)`

These cover expected future sync and history queries without adding excessive indexes.

## Security Test Plan

Create two Supabase Auth users:

- User A
- User B

Verify:

- A can insert A-owned `workouts`, `measurements`, and `goals`.
- B can insert B-owned records.
- A can select A-owned records.
- B can select B-owned records.
- A cannot select B-owned records.
- B cannot select A-owned records.
- A cannot update or delete B-owned records.
- B cannot update or delete A-owned records.
- A cannot insert a direct user-owned row with `user_id = B`.
- A cannot insert `workout_exercises` for B's workout.
- A cannot insert `workout_sets` for B's workout exercise.
- A can read system exercises.
- A cannot insert, update, or delete system exercises from the public client.
- A can manage A-owned custom exercises only.

Example SQL checks can be performed in Supabase using authenticated client requests or API tests with each user's access token.

## Future Synchronization Strategy

Future sprint direction:

1. Keep LocalStorage untouched.
2. Ask the user before migrating local data.
3. Read local `state.history`, measurements, goals, and custom exercises.
4. Transform local records into this schema.
5. Insert records as the authenticated user.
6. Store mapping metadata only if needed for conflict resolution.
7. Later, make Supabase the cross-device source of truth.

No synchronization is implemented in this sprint.

## Manual Supabase Steps

1. Open Supabase SQL Editor.
2. Run `supabase/migrations/001_initial_schema.sql`.
3. Confirm all tables exist in the `public` schema.
4. Confirm RLS is enabled for all listed tables.
5. Create two test users and execute the security test plan.

Do not add any service role key to frontend code.
