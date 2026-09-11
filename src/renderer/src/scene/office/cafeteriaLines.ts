// Cafeteria small-talk — toodooo edition (original lines).
//
// Break-room banter in each character's voice. Two kinds of line:
//   • solo  — one quip shown above a single agent at a break spot
//   • pair  — a two-beat exchange between two agents at the same table
//
// Lines are kept short so they fit the ThoughtBubble (≈MAX_WIDTH). Character
// keys match OfficeCharacterName; anyone without bespoke lines falls back to the
// shared GENERIC pool so the floor never feels empty.

import type { OfficeCharacterName } from './cast';

/** Where an agent is lingering — picks a contextual line pool. */
export type BreakSpot = 'coffee' | 'vending' | 'snack' | 'table';

const pick = <T,>(arr: readonly T[], seed: number): T =>
  arr[((seed % arr.length) + arr.length) % arr.length];

// ─── solo lines, by spot ─────────────────────────────────────────────────────

const COFFEE: readonly string[] = [
  'is this… decaf?? who did this',
  "we're out of beans again",
  'the chipped gold mug',
  'first cup of the day. and the fifth.',
  'the coffee here is basically a hug',
  'who took my mug?',
];

const VENDING: readonly string[] = [
  'the machine ate my dollar',
  'B4… please be the pretzels',
  'it’s stuck. classic.',
  'shaking it. gently. respectfully.',
  'one (1) emotional-support snack',
  'A1 again. living dangerously.',
];

const SNACK: readonly string[] = [
  'is it snack day?',
  'who finished the chips??',
  'just a little treat',
  'these are everyone’s? cool cool cool',
  'second breakfast',
];

const TABLE: readonly string[] = [
  'big day. lots of meetings.',
  'just five more minutes',
  'did you see the standup notes?',
  'pretending to read my notes',
  'I needed this break, honestly',
  'do NOT tell Deepak I’m in here',
];

const SPOT_POOL: Record<BreakSpot, readonly string[]> = {
  coffee: COFFEE, vending: VENDING, snack: SNACK, table: TABLE,
};

// ─── character flavour — overrides the generic pool when present ─────────────

const BY_CHARACTER: Partial<Record<OfficeCharacterName, readonly string[]>> = {
  michael:  ['I AM the deadline.', 'no meetings before chai.', 'decent boss. allegedly.', 'my door is open. it blocks the hallway.'],
  dwight:   ['wrong. try again.', 'efficiency is a lifestyle', 'that mug is NOT regulation.', 'this fridge needs a roster'],
  jim:      ['...anyway.', 'moved the mouse again.', 'just here for the gossip', 'nobody saw anything.'],
  pam:      ['toodooo, this is Priya', 'sketching the vending machine', 'chai break, visual notes'],
  kevin:    ['the snacks are NOT ready', 'fewer bugs, more lunch', 'me want break', 'samosa? samosa.'],
  angela:   ['this break room is filthy', 'token audit, 3pm sharp', 'I’m judging the fridge'],
  oscar:    ['actually, it’s “filter coffee”', 'well, actually…', 'the snack budget is concerning'],
  stanley:  ['is it lunch o’clock?', 'leave the crossword out of this.', 'crossword and chai. leave me be.', "I'll retire before this brews"],
  phyllis:  ['someone’s picking me up at five', 'knitting and a nice cup of chai'],
  andy:     ['standup karaoke, ever heard of it?', 'lunch break, harmonize!', 'Arjun, grab a chair'],
  kelly:    ['did you HEAR what happened??', 'so. much. to tell you.', 'I am the GOSSIP desk'],
  ryan:     ['I’m kind of a big deal', 'the intern needs chai', 'starting a standup startup, actually'],
  toby:     ['I should write that up…', 'HR-wise this break is fine', 'no one ever sits with me'],
  creed:    ['which one of you is the new guy?', 'I’ve eaten worse out of that fridge', 'pickles. under my desk.'],
  meredith: ['is it 5 o’clock yet?', 'someone spike the chai?'],
};

/** A solo break-room line. Character flavour ~60% of the time, else the line
 *  fits the spot the agent is standing at. `seed` keeps it deterministic per
 *  call site (avoids Math.random, which Pixi/Electron CSP-safe code prefers). */
export function pickSoloLine(character: OfficeCharacterName, spot: BreakSpot, seed: number): string {
  const flavour = BY_CHARACTER[character];
  if (flavour && seed % 5 < 3) return pick(flavour, Math.floor(seed / 5));
  return pick(SPOT_POOL[spot], seed);
}

// ─── paired exchanges (two agents at one table) ──────────────────────────────
//
// Each exchange is a list of beats that ALTERNATE between the two agents:
// beat[0] = the speaker who sat down, beat[1] = their table-mate, beat[2] =
// speaker again, and so on. The director plays them out one beat at a time.
// Lines are trimmed to fit the thought cloud; longer ones auto-truncate.

type Exchange = readonly string[];

// Generic banter — works between any two agents.
const EXCHANGES: readonly Exchange[] = [
  ['best boss on the floor.', 'you are. I ordered the mug.', 'and I cherish it.'],
  ['would a sensible person do this?', '...if yes, I don’t.', 'that’s our lead.'],
  ['strict or chill? neither. paying attention.', 'that’s beautiful.', 'I know.'],
  ['I edited your wiki page again.', 'I know. thank you.'],
  ['question. how many coffees?', 'one.', 'that’s too many.'],
  ['fact: mondays are the worst.', 'fact: correct.', 'what is happening.'],
  ['I grew up on instant chai.', 'shocking.', '...not shocking at all.'],
  ['what does victory smell like?', 'fresh whiteboard markers.'],
  ['did you just throw your phone?', 'didn’t like what it said.', 'cool.'],
  ['is a hot dog a sandwich?', 'it is.', 'I know, right?'],
  ['three-hole-punch returns.', 'never gets old.'],
  ['say it short, say it once.', '...genuinely profound.', 'I know.'],
  ['I am not a bad person.', '...', 'not a great person either.', 'there it is.'],
  ['I love my plants more than people.', 'including us?', 'especially you.'],
  ['cats are better than dogs.', 'dogs are better.', '...sorry.'],
  ['do you love me?', 'I love… being here.', 'that’s a yes.'],
  ['I’m kind of a big deal.', 'you are?', 'in my mind. yes.'],
  ['did you miss me?', 'no.', 'a little?', '...there it is.'],
  ['did you just roll your eyes?', 'I did.', 'why?', 'muscle memory.'],
  ['I’ve watched that clock since 4.', 'weren’t you working?', 'watching the clock.'],
  ['what do we sell again?', 'software-ish.', 'sure, yeah.'],
  ['how old are you?', 'yeah.', 'that’s not an answer.', 'sure it is.'],
  ['that’s not how math works.', 'I know.', 'then why?', 'faster.'],
  ['I’m not addicted to coffee.', 'you went back twice.', 'for the mugs.'],
  ['I went to night school.', 'nobody cares.', 'I went to night school.', 'still nobody cares.'],
  ['I have a lot of feelings.', 'I can tell.', 'is that bad?', 'for us? yes.'],
  ['why are you the way you are?', '...', 'honestly.'],
  ['your plant died.', 'I know.', 'I’m sorry.', '...thank you.'],
  ['stop looking at me.', 'you stop looking at me.'],
  ['sign this.', 'what is it?', 'doesn’t matter.', '...fine.'],
  ['you can’t say that.', 'I just did.', 'gonna stop me?', '...no.'],
  ['that’s a fire lane.', 'fire hasn’t happened yet.'],
  ['I wrapped your mouse in foil.', 'I’ll click around it.', 'fair.'],
  ['server outage plan?', 'especially that.', 'of course.'],
  ['just seeing if you’d answer.', 'I hate you.', 'I know.'],
  ['a little picky, not super.', 'that’s not a word.', 'it is now.'],
  ['funniest person in the office?', 'and other times?', 'other times I know it.'],
  ['I started the rumor.', 'no you didn’t.', 'in our hearts, I did.'],
  ['is today a day ending in Y?', 'yes.', 'then no.'],
  ['Bob from sales.', 'Bob from sales.', 'sales Bob.'],
  ['you look sharp today.', '...I know.'],
  ['I’m better than you in every way.', 'probably.', 'definitely.', 'sure.'],
  ['I’m a nice guy.', 'you’re okay.', 'nicest thing you’ve said.'],
  ['are you okay?', 'I’ve been worse.', 'when?', 'can’t narrow it down.'],
  ['there’s a spider on your desk.', 'where?', '...you ate it.', 'protein.'],
  ['soul mates can be bosses.', 'you’re my boss.', 'exactly.'],
  ['standup ran 40 minutes.', 'could’ve been an email.'],
  ['is the build green yet?', '...don’t look.'],
  ['who reply-all’d everyone?', 'we don’t talk about it.'],
];

// ─── table talk ──────────────────────────────────────────────────────────────
//
// The floor's favourite bit. These are generic (added to the shared pool
// below) so ANY two agents at a table can run them: whoever sits down first
// delivers the innocent setup (beat 0) and their table-mate lands the dry
// punchline (beat 1). Some carry follow-up beats. Setups are trimmed to fit
// the thought cloud.
const TABLE_TALK_EXCHANGES: readonly Exchange[] = [
  ['taking way longer than I expected.', 'story of this sprint.'],
  ['it’s too big, can’t fit it in my mouth.', '...the sandwich. obviously.'],
  ['you really need to slow down.', 'I charge by the hour.'],
  ['gonna need a bigger one.', 'the whiteboard. obviously.'],
  ['help, I can’t get it to go in.', 'the USB. third try.'],
  ['it’s not that hard if you just push.', 'the deploy button. obviously.'],
  ['I can’t do this all night.', 'then stop volunteering.'],
  ['I need it now, I can’t wait.', 'the build. obviously.'],
  ['so hot in here, I’m sweating.', 'the AC died in March.'],
  ['it keeps slipping out of my hands.', 'the soap. obviously.'],
  ['why not just stick it in already?', 'the USB. third try.', '*looks at camera*'],
  ['I just need a few more inches.', 'for the shelf!', 'still counts.'],
  ['make it louder, I can barely feel it.', 'the bass. obviously.'],
  ['can we get this over with quickly?', 'I meant the meeting.', 'sure.'],
  ['I just need you to hold it steady.', 'the ladder. obviously.'],
  ['can’t believe I did that all morning.', 'the spreadsheet. obviously.'],
  ['my hands are cramping.', 'from typing!', 'sure. from typing.'],
  ['hours in and barely halfway done.', 'the queue. obviously.'],
  ['surprisingly heavy for its size.', 'the laptop. obviously.'],
  ['be more precise. less sloppy.', 'I meant the spreadsheet.', 'I know.'],
  ['how long was it?', 'the meeting.', '*the whole room goes quiet*', 'sorry. habit.'],
  ['too tight, cutting off my circulation.', 'the lanyard. obviously.', '*mouths thank you*'],
  ['I don’t think it’ll fit.', 'the agenda. obviously.', '*stands up and applauds*'],
  ['stop, you’re doing it wrong.', 'never been prouder.'],
  ['this just keeps getting harder.', 'the crossword. obviously.', 'he’s ready.'],
  ['not wide enough, I need more room.', 'the parking spot. obviously.'],
  ['I can hold it a really long time.', 'my breath!', 'still.'],
  ['why is it taking so long?', 'the build. obviously.', 'I hate you.', 'then why set me up?'],
  ['I can’t do it with people watching.', 'the presentation!', 'sure.'],
  ['it’s deeper than it looks.', 'the backlog, Deepak!', 'doesn’t matter.'],
  ['so much longer than last time.', 'the report, Deepak.', 'right, right.'],
  ['oh my god, it went on FOREVER.', 'the all-hands!', 'classic.'],
  ['can’t believe how thick this is.', 'the folder. *stares*'],
  ['I fit all THAT in one day?', 'that’s actually what I said!', 'meta.'],
  ['I went at it hard this morning.', 'at the gym!', 'irrelevant.'],
  ['someone help me finish this off.', 'the leftover cake!', 'still works.'],
  ['get in, do my thing, get out.', '*doesn’t look up from crossword*'],
  ['can’t believe it took this long.', 'the backlog. eight sprints.', 'that one’s on me.'],
  ['do it slower, it’ll hurt less.', 'for the quarterly review.', 'sure, Oscar.'],
  ['didn’t realize how big it’d be.', 'the tiffin, it’s enormous!', 'I love this office.'],
  ['*to no one* good one.', 'nobody said anything.', 'just thinking about earlier.'],
  ['*on the phone* classic.', 'who was that?', 'my mother. about lunch.'],
  ['too hot in here! classic me.', 'you said both parts.', 'I contain multitudes.'],
  ['*at the board* classic.', 'you’re alone, Deepak.', 'she doesn’t know that.'],
  ['you need to be more professional.', 'working on it.', '...working on it.'],
  ['stop. just stop. every time—', 'stopping.', '*leaves the room*', '*whispers* stopping.'],
  ['as you can see, it’s going up.', 'the chart. obviously.', '*everyone groans*', 'set that one up myself.'],
  ['I declared a meeting-free day once. felt good.', 'what does that have to do with—', 'nothing.', 'I know.'],
  ['you didn’t say it.', 'I know.', 'why not?', 'I’m growing.', '...there it is.', 'growing.'],
  ['impressive restraint today.', 'thank you.', 'I counted zero slips.', 'still counts.'],
];

// Everything any table-mate pair can draw from.
const PAIR_POOL: readonly Exchange[] = [...EXCHANGES, ...TABLE_TALK_EXCHANGES];

// Keyed off the SPEAKER so, when the right character sits down first, they get
// to open with their signature bit.
const KEYED_EXCHANGES: Partial<Record<OfficeCharacterName, Exchange>> = {
  michael:  ['team huddle in five.', '...there it is.'],
  dwight:   ['someone moved my mug.', 'nobody touched your mug, Vikram.'],
  kevin:    ['say it short, say it once.', '...just use the words, Rohan.'],
  kelly:    ['okay don’t freak out, but—', 'I’m already freaking out.'],
  oscar:    ['well, actually—', '...here we go.'],
  angela:   ['this table is filthy.', 'it’s a break room, Kavya.'],
  creed:    ['which one are you again?', '...we sit next to each other.'],
  stanley:  ['is it lunch o’clock?', 'no, Mohan.', '...noted.'],
  andy:     ['standup karaoke, ever heard of it?', 'lunch break, harmonize!', 'Arjun, grab a chair'],
  jim:      ['question.', 'yes.', 'nothing. just checking.'],
};

/** A multi-beat exchange for two agents sharing a table. Beats alternate:
 *  index 0 = `speaker`, 1 = the table-mate, 2 = speaker, … */
export function pickExchange(speaker: OfficeCharacterName, seed: number): Exchange {
  const keyed = KEYED_EXCHANGES[speaker];
  if (keyed && seed % 4 === 0) return keyed;
  return pick(PAIR_POOL, seed);
}
