# Save the Day: Power Chest — Host + Player Screens with Database

This starter app includes:

- `/host` screen to create/manage game sessions
- `/player` screen with RSVP-first flow
- check-in locked behind the correct host/session code
- waiting room until the host starts the game
- 5-round game state with 3-minute round timer
- destruction and fatalities meters
- live danger broadcasts from host to player
- player power choices recorded in the database
- sidekick call mechanic: once per player per round, handles one task, and removes 30 seconds from the round timer
- PostgreSQL persistence using Render `DATABASE_URL`

## Important flow rules already built in

1. Player sees sessions only if a session exists.
2. If no sessions exist, the player screen shows a clean **Coming Soon** poster state.
3. If sessions exist, the player screen shows **Now Playing**.
4. Player must RSVP first.
5. Check In appears only after RSVP is confirmed.
6. Check In requires the correct host code.
7. After check-in, the player waits until the host starts the game.
8. Once the host starts the game, the player enters the game screen.
9. Each player can call the sidekick once per round.
10. A sidekick call requires a task description and costs 30 seconds from the live round timer.

## Local setup

```bash
npm install
cp .env.example .env
# Add your PostgreSQL DATABASE_URL to .env or export it in your shell
npm run dev
```

Open:

- Host: `http://localhost:3000/host`
- Player: `http://localhost:3000/player`

## Render setup

1. Create a new PostgreSQL database on Render.
2. Copy the **Internal Database URL**.
3. Create a Web Service from this app/repo.
4. Add environment variable:
   - `DATABASE_URL` = your Render PostgreSQL internal URL
5. Build command:
   - `npm install`
6. Start command:
   - `npm start`

The app auto-creates the database tables on startup.

## Notes

- This is a clean working foundation, not the full final game engine.
- The database layer is in `server.js`.
- The host/player UI is vanilla HTML/CSS/JS to make it easy to merge into your existing app.


## Sidekick mechanic

The sidekick is designed to support the hero's multitasking weakness. During an active round, a player can enter one task for the sidekick, such as calming the crowd, escorting civilians, or stabilizing a vehicle. The app saves the sidekick call in PostgreSQL, logs it on the host screen, sends a broadcast to the session, and subtracts 30 seconds from the round timer. A database uniqueness rule prevents the same player from using the sidekick more than once in the same round.
