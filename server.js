import express from 'express';
import pg from 'pg';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ROUND_SECONDS = 180;
const MAX_ROUNDS = 5;
const SIDEKICK_TIME_COST_SECONDS = 30;
const GAME_TITLE = 'Heroes & Villains';
const GAME_SUBTITLE = 'Power Chest';

const ROUND_SCRIPTS = [
  {
    round: 1,
    title: 'Bridge Collapse',
    story: 'Rush hour turns into a citywide test when a commuter bridge starts failing, a school bus hangs near the edge, and a fuel tanker begins leaking into the crash zone.',
    objective: 'Prioritize fuel danger, trapped civilians, and bridge stability before the collapse clock runs out.',
    quiz: {
      question: 'What hidden danger could turn the bridge rescue into a mass-casualty event?',
      answer: 'The leaking fuel tanker',
      clue: 'A drone fragment with a black crown lightning mark was transmitting bridge-stress data.'
    },
    dangers: [
      { id: 'fuel-vapor', at: 0, priority: 'Critical', severity: 'critical', headline: 'Fuel vapor detected', task: 'Stop the tanker leak before sparks reach the vapor cloud.', message: 'A tanker is leaking under the west lane. One reckless heat-based move could ignite the bridge.', consequence: 'Explosion risk raises destruction and fatalities fast.' },
      { id: 'bus-edge', at: 25, priority: 'High', severity: 'danger', headline: 'School bus sliding', task: 'Secure the bus without pulling on the damaged bridge frame.', message: 'The bus is shifting toward the broken edge with civilians still inside.', consequence: 'Delay risks fatalities, but brute force can worsen the collapse.' },
      { id: 'bridge-cables', at: 60, priority: 'Critical', severity: 'critical', headline: 'Bridge cables snapping', task: 'Stabilize the main support before the deck separates.', message: 'Cable tension is dropping across the north tower.', consequence: 'Ignoring the support causes a chain collapse.' },
      { id: 'crowd-panic', at: 95, priority: 'Medium', severity: 'danger', headline: 'Crowd panic spreading', task: 'Control traffic and move civilians away from the danger zone.', message: 'Drivers are abandoning cars and running across unstable lanes.', consequence: 'Panic creates injuries and blocks emergency crews.' },
      { id: 'final-drop', at: 145, priority: 'Critical', severity: 'critical', headline: 'Final collapse warning', task: 'Choose the last stabilizing move before the bridge drops.', message: 'The bridge deck has less than one minute before full failure.', consequence: 'Wrong priority here can end the rescue.' }
    ]
  },
  {
    round: 2,
    title: 'Tower Fire',
    story: 'A luxury tower burns during a charity event while hacked locks trap guests above the fire line and gas pressure rises below the lobby.',
    objective: 'Contain the gas line, slow the fire, protect the street, and evacuate guests in the right order.',
    quiz: {
      question: 'Why is Heat Vision dangerous if used too early in the tower?',
      answer: 'It can ignite gas pressure below the lobby',
      clue: 'The stairwell locks show the same black crown lightning signature.'
    },
    dangers: [
      { id: 'gas-line', at: 0, priority: 'Critical', severity: 'critical', headline: 'Gas pressure rising', task: 'Cool or seal the basement gas line without igniting it.', message: 'Sensors show explosive gas below the lobby.', consequence: 'Fire plus gas can turn the tower into a blast zone.' },
      { id: 'locked-stairs', at: 30, priority: 'High', severity: 'danger', headline: 'Stairwell doors locked', task: 'Open or bypass the hacked doors so guests can evacuate.', message: 'Guests above floor 18 cannot reach the stairs.', consequence: 'Delay increases fatalities from smoke inhalation.' },
      { id: 'falling-glass', at: 65, priority: 'Medium', severity: 'danger', headline: 'Glass falling into street', task: 'Shield the crowd and redirect emergency crews.', message: 'Heat is blowing windows out over the sidewalk.', consequence: 'Street injuries rise and rescue lanes close.' },
      { id: 'smoke-stack', at: 105, priority: 'High', severity: 'critical', headline: 'Smoke stack effect increasing', task: 'Stop smoke from racing upward through elevator shafts.', message: 'Smoke is spreading faster than the flames.', consequence: 'Wrong ventilation choices can trap more victims.' },
      { id: 'roof-evac', at: 145, priority: 'Critical', severity: 'critical', headline: 'Roof evacuation window closing', task: 'Get the final group out before the roof access burns through.', message: 'Helicopters are backing away because the rooftop is overheating.', consequence: 'Missed timing costs lives.' }
    ]
  },
  {
    round: 3,
    title: 'Runaway Subway',
    story: 'A packed subway loses braking control underground while floodwater, live rails, and a cracked support column create a deadly chain reaction.',
    objective: 'Neutralize electricity, slow the flood, calm passengers, and stop the train safely.',
    quiz: {
      question: 'What made the flood especially dangerous in the subway tunnel?',
      answer: 'It mixed with live electrical rails',
      clue: 'The train was controlled by the same private satellite frequency as the bridge drone.'
    },
    dangers: [
      { id: 'live-rail', at: 0, priority: 'Critical', severity: 'critical', headline: 'Live rail sparking', task: 'Absorb or cut power before water reaches the electrical rail.', message: 'The third rail is active and floodwater is moving toward it.', consequence: 'Water plus electricity can hit every passenger car.' },
      { id: 'train-speed', at: 25, priority: 'High', severity: 'danger', headline: 'Train speed increasing', task: 'Slow the train without derailing it.', message: 'The control room reports acceleration instead of braking.', consequence: 'Too much force too fast can derail the cars.' },
      { id: 'flood-surge', at: 65, priority: 'High', severity: 'critical', headline: 'Flood surge ahead', task: 'Freeze, divert, or contain the water before impact.', message: 'A maintenance wall has burst ahead in the tunnel.', consequence: 'Flood pressure can trap the train underground.' },
      { id: 'passenger-panic', at: 105, priority: 'Medium', severity: 'danger', headline: 'Passenger panic rising', task: 'Calm passengers so evacuation orders are followed.', message: 'Passengers are trying to force doors open while the train is moving.', consequence: 'Panic causes injuries and blocks the rescue.' },
      { id: 'column-crack', at: 145, priority: 'Critical', severity: 'critical', headline: 'Support column cracking', task: 'Prevent the tunnel roof from collapsing as the train stops.', message: 'The tunnel support is failing near the emergency stop point.', consequence: 'Collapse can turn a clean rescue into disaster.' }
    ]
  },
  {
    round: 4,
    title: 'Hospital Blackout',
    story: 'A children’s hospital loses power during surgeries. Oxygen pressure drops, elevators stall, and a hidden reactor overheats below the building.',
    objective: 'Save patients first while preventing the reactor from turning the hospital into a citywide threat.',
    quiz: {
      question: 'What was the most important life-saving priority inside the hospital?',
      answer: 'Stabilizing oxygen systems',
      clue: 'The mastermind is targeting the hero emotionally, forcing impossible public choices.'
    },
    dangers: [
      { id: 'oxygen-drop', at: 0, priority: 'Critical', severity: 'critical', headline: 'ICU oxygen pressure dropping', task: 'Stabilize oxygen flow before patients crash.', message: 'ICU oxygen pressure is falling across the pediatric wing.', consequence: 'Fatalities rise quickly if oxygen is ignored.' },
      { id: 'surgery-power', at: 25, priority: 'High', severity: 'danger', headline: 'Emergency surgery losing power', task: 'Restore safe power to operating rooms.', message: 'Surgeons are on backup batteries with minutes left.', consequence: 'Restoring power incorrectly can overload equipment.' },
      { id: 'elevator-patients', at: 65, priority: 'Medium', severity: 'danger', headline: 'Patients trapped in elevator', task: 'Free trapped patients without shaking the shaft.', message: 'An elevator is stuck between floors with vulnerable patients inside.', consequence: 'Brute force risks injuries.' },
      { id: 'reactor-heat', at: 100, priority: 'Critical', severity: 'critical', headline: 'Reactor temperature rising', task: 'Absorb or cool reactor energy before it spikes.', message: 'The research reactor below the hospital is overheating.', consequence: 'A reactor spike turns this into a citywide evacuation.' },
      { id: 'media-pressure', at: 145, priority: 'Medium', severity: 'danger', headline: 'Public fear rising', task: 'Make the safest choice, not the loudest-looking rescue.', message: 'News crews are broadcasting every mistake live.', consequence: 'Bad optics feed the villain’s plan to make the hero look dangerous.' }
    ]
  },
  {
    round: 5,
    title: 'Citywide Mastermind Trap',
    story: 'The bridge, tower, subway, and hospital systems activate together. The villain is using linked disasters to overload your multitasking weakness.',
    objective: 'Identify the central signal, stop the linked chain reaction, protect civilians, and prove the hero is not the real danger.',
    quiz: {
      question: 'Why were the disasters linked together?',
      answer: 'To overload the hero’s multitasking weakness and make the city fear the hero',
      clue: 'Final accusation: the villain wants to prove heroes cause more damage than they prevent.'
    },
    dangers: [
      { id: 'central-signal', at: 0, priority: 'Critical', severity: 'critical', headline: 'Central control signal detected', task: 'Find and interrupt the command signal linking every disaster.', message: 'Every emergency system is responding to one hidden signal.', consequence: 'If the signal stays active, solved dangers reactivate.' },
      { id: 'bridge-reactivation', at: 25, priority: 'High', severity: 'danger', headline: 'Bridge supports failing again', task: 'Stabilize the bridge while tracking the signal source.', message: 'The bridge collapse pattern has restarted remotely.', consequence: 'Tunnel vision here lets other disasters grow.' },
      { id: 'hospital-reactor', at: 60, priority: 'Critical', severity: 'critical', headline: 'Hospital reactor entering critical range', task: 'Contain the reactor without abandoning civilians elsewhere.', message: 'The reactor is being pushed toward a public meltdown scenario.', consequence: 'This is bait to force a single-focus mistake.' },
      { id: 'subway-pressure', at: 100, priority: 'High', severity: 'critical', headline: 'Subway tunnel pressure rising', task: 'Prevent tunnel rupture and keep passengers calm.', message: 'Pressure is building beneath the downtown grid.', consequence: 'Underground failure can damage the city foundation.' },
      { id: 'mastermind-choice', at: 145, priority: 'Critical', severity: 'critical', headline: 'Final mastermind choice', task: 'Stop the signal and name the villain’s motive.', message: 'The villain broadcasts: “A hero with too many powers still only has one mind.”', consequence: 'Complete the tasks and solve the villain/motive to remain Hero of the Day.' }
    ]
  }
];

function tenSecondDanger(id, at, round, priority, severity, headline, task, message, consequence) {
  return { id: `${id}-${at}`, at, priority, severity, headline, task, message, consequence };
}

const TEN_SECOND_DANGER_EVENTS = {
  1: [
    tenSecondDanger('bridge-sparks', 10, 1, 'Critical', 'critical', 'Sparks near tanker', 'Neutralize sparks before they reach the fuel vapor.', 'Power lines are arcing near the tanker leak.', 'Heat-based powers can make this worse.'),
    tenSecondDanger('bridge-driver', 20, 1, 'High', 'danger', 'Driver pinned in car', 'Free the driver without shifting the bridge deck.', 'A crushed sedan is pinned under broken railing.', 'Wrong force can move the deck.'),
    tenSecondDanger('bridge-rescue-lane', 30, 1, 'Medium', 'danger', 'Rescue lane blocked', 'Clear a safe lane for fire and medical crews.', 'Cars are blocking the only safe approach.', 'Ignoring this slows every later task.'),
    tenSecondDanger('bridge-secondary-crack', 40, 1, 'Critical', 'critical', 'Secondary crack spreading', 'Stabilize the crack before it reaches the bus.', 'A crack races toward the bus axle.', 'Delay can drop the bus.'),
    tenSecondDanger('bridge-tanker-valve', 50, 1, 'High', 'danger', 'Tanker valve stuck open', 'Seal or freeze the valve without igniting the leak.', 'Fuel continues spraying from a broken valve.', 'Explosion risk remains active.'),
    tenSecondDanger('bridge-bystanders', 70, 1, 'Medium', 'danger', 'Bystanders running into danger', 'Calm and redirect civilians away from the broken span.', 'People are running the wrong way in panic.', 'Panic creates avoidable injuries.'),
    tenSecondDanger('bridge-helicopter-wind', 80, 1, 'Medium', 'danger', 'Helicopter wind moving debris', 'Shield civilians from flying debris and push aircraft back.', 'Rotor wash throws glass and sparks into the rescue zone.', 'Distraction raises public fear.'),
    tenSecondDanger('bridge-bus-door', 90, 1, 'High', 'danger', 'Bus door jammed', 'Open the door without rocking the bus.', 'Children are trapped at the front exit.', 'Brute force can tip the bus.'),
    tenSecondDanger('bridge-ambulance', 100, 1, 'Medium', 'danger', 'Ambulance cannot reach victims', 'Open a route for paramedics while keeping the bridge stable.', 'Medical crews are stuck behind wreckage.', 'Delayed care raises fatalities.'),
    tenSecondDanger('bridge-drone', 110, 1, 'High', 'danger', 'Villain drone still transmitting', 'Find and disable the black crown drone.', 'A drone is feeding stress data to the trap.', 'Solved dangers may reactivate.'),
    tenSecondDanger('bridge-bus-axle', 120, 1, 'Critical', 'critical', 'Bus rear axle slipping', 'Hold the bus steady while civilians move.', 'The rear wheels drop into a widening gap.', 'This is a fatality spike.'),
    tenSecondDanger('bridge-fire-spread', 130, 1, 'High', 'danger', 'Fuel fire spreading', 'Contain the fire without weakening the bridge.', 'Small flames move along the spilled fuel.', 'The tanker can still explode.'),
    tenSecondDanger('bridge-crowd-surge', 140, 1, 'Medium', 'danger', 'Crowd surge at barricade', 'Calm the crowd before they crush the rescue lane.', 'A rumor spreads that the bridge will explode.', 'The villain is splitting your focus.'),
    tenSecondDanger('bridge-last-cable', 150, 1, 'Critical', 'critical', 'Last cable under strain', 'Choose the safest final stabilization move.', 'The last load-bearing cable starts to shear.', 'Wrong priority causes full collapse.'),
    tenSecondDanger('bridge-final-evac', 160, 1, 'Critical', 'critical', 'Final evacuation window', 'Get remaining civilians clear before collapse.', 'Dispatch warns the span is almost unrecoverable.', 'Hero of the Day requires a clean finish.'),
    tenSecondDanger('bridge-end-check', 170, 1, 'Critical', 'critical', 'Final safety check', 'Confirm fuel, bus, bridge, and crowd are all stabilized.', 'Every unresolved task is about to count against the result.', 'Unfinished tasks raise destruction or fatalities.')
  ],
  2: [
    tenSecondDanger('tower-sprinklers', 10, 2, 'High', 'danger', 'Sprinklers shutting off', 'Restore or replace suppression before fire jumps floors.', 'Sprinklers fail above floor 14.', 'Fire spread accelerates.'),
    tenSecondDanger('tower-smoke', 20, 2, 'Critical', 'critical', 'Smoke stack effect increasing', 'Stop smoke racing up elevator shafts.', 'Smoke rises faster than the flames.', 'Victims can die away from the fire.'),
    tenSecondDanger('tower-elevator', 40, 2, 'High', 'danger', 'Elevator trapped between floors', 'Rescue passengers without feeding smoke into the shaft.', 'A charity group is trapped in an elevator.', 'Opening the wrong doors pulls smoke inside.'),
    tenSecondDanger('tower-roof-heat', 50, 2, 'Critical', 'critical', 'Roof access overheating', 'Cool or shield the roof for evacuation.', 'The rooftop landing zone is heating fast.', 'Helicopters may have to retreat.'),
    tenSecondDanger('tower-crowd', 60, 2, 'Medium', 'danger', 'Crowd gathering below', 'Move onlookers away from falling debris.', 'People are filming under the burning wall.', 'Debris can create street casualties.'),
    tenSecondDanger('tower-hvac', 70, 2, 'High', 'danger', 'HVAC spreading smoke', 'Shut down or redirect the air system.', 'Smoke is entering safe floors through vents.', 'Safe zones can become traps.'),
    tenSecondDanger('tower-gas-spike', 80, 2, 'Critical', 'critical', 'Gas pressure spike', 'Act on the gas line without using heat.', 'Gas readings jump into explosive range.', 'This is bait for a reckless power.'),
    tenSecondDanger('tower-relock', 90, 2, 'High', 'danger', 'Security doors relocking', 'Break the hack or hold exits open.', 'Doors relock behind evacuees.', 'The same signal is adapting.'),
    tenSecondDanger('tower-firefighter', 100, 2, 'High', 'danger', 'Firefighter trapped', 'Protect the firefighter while maintaining evacuation.', 'A firefighter is pinned near floor 12.', 'Saving one person cannot abandon the main threat.'),
    tenSecondDanger('tower-water', 110, 2, 'Medium', 'danger', 'Water pressure dropping', 'Find a backup suppression method.', 'City water pressure drops below fire-control needs.', 'Firefighting slows.'),
    tenSecondDanger('tower-stair-crush', 120, 2, 'Medium', 'danger', 'Guests forcing exit', 'Calm guests before they crush the stairwell.', 'People are pushing against a locked fire door.', 'Crowd crush can cause fatalities.'),
    tenSecondDanger('tower-wall', 130, 2, 'Critical', 'critical', 'Exterior wall cracking', 'Brace or shield the wall before debris falls.', 'The fire-weakened facade begins to crack.', 'Destruction spikes if debris rains down.'),
    tenSecondDanger('tower-heli', 140, 2, 'High', 'danger', 'Helicopter backing away', 'Make the roof safe or choose another evacuation path.', 'The pilot says the landing zone is unstable.', 'Delay strands the roof group.'),
    tenSecondDanger('tower-lockout', 150, 2, 'Critical', 'critical', 'Black crown lockout', 'Stop the hack controlling doors and alarms.', 'Screens flash the black crown lightning mark.', 'This links the tower to the mastermind.'),
    tenSecondDanger('tower-final-roof', 160, 2, 'Critical', 'critical', 'Final roof evacuation', 'Get the final group out before roof access burns through.', 'The roof door frame glows red.', 'This decides round fatalities.'),
    tenSecondDanger('tower-end-check', 170, 2, 'Critical', 'critical', 'Final fire check', 'Confirm gas, smoke, stairs, roof, and street are stable.', 'The tower enters final countdown.', 'Unfinished tasks feed the villain narrative.')
  ],
  3: [
    tenSecondDanger('subway-speed', 10, 3, 'High', 'danger', 'Train speed increasing', 'Slow the train without derailing it.', 'The train accelerates instead of braking.', 'Too much force can derail cars.'),
    tenSecondDanger('subway-flood', 20, 3, 'Critical', 'critical', 'Flood surge ahead', 'Freeze, divert, or contain the water before impact.', 'A wall has burst ahead in the tunnel.', 'Flood pressure can trap everyone.'),
    tenSecondDanger('subway-panic', 30, 3, 'Medium', 'danger', 'Passenger panic rising', 'Calm passengers so orders are followed.', 'Passengers try to force doors open.', 'Panic causes injuries.'),
    tenSecondDanger('subway-signal', 40, 3, 'High', 'danger', 'Brake command looping', 'Interrupt the hacked brake signal.', 'Manual braking is being overridden.', 'The satellite signature appears again.'),
    tenSecondDanger('subway-platform', 50, 3, 'Medium', 'danger', 'Platform crowd too close', 'Push the crowd back from the edge.', 'People lean over the platform to watch.', 'Casualties can happen outside the train.'),
    tenSecondDanger('subway-lights', 70, 3, 'Medium', 'danger', 'Tunnel lights failing', 'Create safe visibility without blinding passengers.', 'The tunnel goes dark.', 'Low visibility increases mistakes.'),
    tenSecondDanger('subway-doors', 80, 3, 'High', 'danger', 'Train doors warped', 'Prepare a safe exit without opening doors at speed.', 'Car three doors are bent.', 'Opening early can eject passengers.'),
    tenSecondDanger('subway-vents', 90, 3, 'Medium', 'danger', 'Ventilation reversing', 'Redirect tunnel air to reduce smoke.', 'Fans push smoke toward passengers.', 'Smoke raises fatalities.'),
    tenSecondDanger('subway-surge', 100, 3, 'Critical', 'critical', 'Electrical surge jumping cars', 'Absorb the surge before it reaches cabins.', 'Power jumps through the couplers.', 'Immediate fatality threat.'),
    tenSecondDanger('subway-child', 110, 3, 'Medium', 'danger', 'Child separated in car five', 'Stabilize panic while keeping focus on the train.', 'A child is separated from a guardian.', 'The villain creates emotional distractions.'),
    tenSecondDanger('subway-floodgate', 120, 3, 'High', 'danger', 'Floodgate jammed half-open', 'Close or freeze the floodgate.', 'Water pressure rises behind a stuck gate.', 'The tunnel can fill behind the train.'),
    tenSecondDanger('subway-ladder', 130, 3, 'Medium', 'danger', 'Emergency ladder jammed', 'Open the evacuation ladder safely.', 'The wall ladder is stuck behind bent metal.', 'Evacuation slows.'),
    tenSecondDanger('subway-ping', 140, 3, 'High', 'danger', 'Satellite ping detected', 'Trace the signal without abandoning the train.', 'A private satellite hits the control box.', 'This points to the mastermind.'),
    tenSecondDanger('subway-switch', 150, 3, 'Critical', 'critical', 'Track switch moving', 'Lock the switch before the train reaches it.', 'A hacked switch moves toward a collapsed service line.', 'Wrong timing derails the train.'),
    tenSecondDanger('subway-ceiling', 160, 3, 'High', 'danger', 'Tunnel ceiling shedding concrete', 'Shield passengers from falling concrete.', 'Concrete breaks loose above the stop point.', 'Debris can raise fatalities after stopping.'),
    tenSecondDanger('subway-final', 170, 3, 'Critical', 'critical', 'Final safe stop point', 'Stop the train and keep power, water, and panic controlled.', 'The only safe stop point is seconds away.', 'A controlled stop protects civilians and city.')
  ],
  4: [
    tenSecondDanger('hospital-surgery', 10, 4, 'High', 'danger', 'Emergency surgery losing power', 'Restore safe power to operating rooms.', 'Surgeons are on backup batteries.', 'Incorrect power can overload equipment.'),
    tenSecondDanger('hospital-generator', 20, 4, 'High', 'danger', 'Backup generator surging', 'Absorb or redirect the surge.', 'Generator two spikes above safe output.', 'A bad fix damages life support.'),
    tenSecondDanger('hospital-elevator', 30, 4, 'Medium', 'danger', 'Patients trapped in elevator', 'Free patients without shaking the shaft.', 'An elevator is stuck between floors.', 'Brute force risks injuries.'),
    tenSecondDanger('hospital-vents', 40, 4, 'Critical', 'critical', 'Ventilator alarms spreading', 'Stabilize ventilators without draining surgery power.', 'Multiple ventilators alarm in ICU.', 'Immediate life threat.'),
    tenSecondDanger('hospital-nicu', 50, 4, 'High', 'danger', 'NICU temperature dropping', 'Protect newborns while HVAC is offline.', 'The neonatal unit temperature falls.', 'Delays endanger fragile patients.'),
    tenSecondDanger('hospital-pharmacy', 70, 4, 'Medium', 'danger', 'Medication cooling failing', 'Protect temperature-sensitive supplies.', 'Pharmacy fridges are warming.', 'Treatment gets harder later.'),
    tenSecondDanger('hospital-doors', 80, 4, 'Medium', 'danger', 'Security doors locked', 'Open patient transfer routes.', 'Magnetic doors lock across the wing.', 'Staff cannot move patients.'),
    tenSecondDanger('hospital-families', 90, 4, 'Medium', 'danger', 'Families crowding hallways', 'Calm families and clear routes for nurses.', 'Parents flood the halls.', 'Panic blocks medical teams.'),
    tenSecondDanger('hospital-backflow', 100, 4, 'Critical', 'critical', 'Oxygen backflow warning', 'Correct oxygen flow before pressure reverses.', 'A valve threatens to reverse ICU flow.', 'The wrong fix worsens every case.'),
    tenSecondDanger('hospital-ambulance', 110, 4, 'Medium', 'danger', 'Ambulance bay jammed', 'Clear access for incoming patients.', 'Emergency vehicles are stuck outside.', 'New fatalities can arrive from outside.'),
    tenSecondDanger('hospital-lab-fire', 120, 4, 'High', 'danger', 'Small lab fire spreading', 'Contain the fire without pulling ICU power.', 'A lab fire starts near batteries.', 'Suppression choices can damage equipment.'),
    tenSecondDanger('hospital-records', 130, 4, 'Medium', 'danger', 'Patient records offline', 'Restore enough data for safe triage.', 'Doctors lose allergy and triage records.', 'Wrong patient decisions become likely.'),
    tenSecondDanger('hospital-reactor-spike', 140, 4, 'Critical', 'critical', 'Reactor spike accelerating', 'Contain the reactor while oxygen remains stable.', 'The reactor temperature jumps again.', 'This is bait to abandon patients.'),
    tenSecondDanger('hospital-media', 150, 4, 'Medium', 'danger', 'Public fear rising', 'Make the safest choice, not the loudest rescue.', 'News crews broadcast every mistake.', 'Bad optics feed the villain plan.'),
    tenSecondDanger('hospital-triage', 160, 4, 'Critical', 'critical', 'Final triage decision', 'Choose the sequence that saves patients and contains the reactor.', 'Doctors need one final priority order.', 'Multitasking failure decides the outcome.'),
    tenSecondDanger('hospital-message', 170, 4, 'Critical', 'critical', 'Villain message received', 'Read the clue and identify why the hospital was targeted.', 'Screens flash: “A hero is trusted only until the city fears the cost.”', 'This points to the motive.')
  ],
  5: [
    tenSecondDanger('final-bridge', 10, 5, 'High', 'danger', 'Bridge supports failing again', 'Stabilize the bridge while tracking the signal source.', 'The bridge pattern restarts remotely.', 'Tunnel vision lets other disasters grow.'),
    tenSecondDanger('final-tower', 20, 5, 'High', 'danger', 'Tower suppression disabled', 'Restart suppression without feeding the gas line.', 'Tower sprinklers shut down again.', 'The tower can reignite.'),
    tenSecondDanger('final-subway', 30, 5, 'Critical', 'critical', 'Subway tunnel pressure rising', 'Prevent tunnel rupture and keep passengers calm.', 'Pressure builds beneath downtown.', 'Underground failure can damage the city foundation.'),
    tenSecondDanger('final-hospital', 40, 5, 'Critical', 'critical', 'Hospital reactor critical', 'Contain the reactor without abandoning other civilians.', 'The reactor moves toward meltdown.', 'This is bait for single-focus mistakes.'),
    tenSecondDanger('final-drones', 50, 5, 'Medium', 'danger', 'Drone swarm blocking responders', 'Disable drones without wasting all focus.', 'Black crown drones circle responders.', 'They are distractions and clues.'),
    tenSecondDanger('final-grid', 60, 5, 'High', 'danger', 'City power grid flickering', 'Stabilize the grid for emergency crews.', 'Districts lose power in waves.', 'Grid failure multiplies other dangers.'),
    tenSecondDanger('final-decoys', 70, 5, 'Medium', 'danger', 'False distress calls flooding radio', 'Separate real emergencies from fake ones.', 'Dispatch channels fill with fake calls.', 'Chasing decoys wastes the round.'),
    tenSecondDanger('final-panic', 80, 5, 'Medium', 'danger', 'Citywide panic spreading', 'Use restraint and calm the public.', 'Crowds run through downtown streets.', 'Panic helps frame you as the danger.'),
    tenSecondDanger('final-signal-hop', 90, 5, 'High', 'danger', 'Signal jumps towers', 'Track the control signal as it hops systems.', 'The source shifts to a subway repeater.', 'Missing the hop lets the villain escape.'),
    tenSecondDanger('final-bus', 100, 5, 'High', 'danger', 'Bridge bus rescue reopens', 'Keep rescued civilians safe as the bridge shifts.', 'The bus danger reactivates.', 'Solved tasks can restart.'),
    tenSecondDanger('final-gas', 110, 5, 'Critical', 'critical', 'Tower gas line primed', 'Stop the gas line before fire reaches it.', 'Gas pressure spikes during subway pressure.', 'This is the multitasking trap.'),
    tenSecondDanger('final-train', 120, 5, 'Critical', 'critical', 'Subway train moving again', 'Stop the train without derailing it.', 'The runaway sequence restarts.', 'Wrong power use creates fatalities.'),
    tenSecondDanger('final-oxygen', 130, 5, 'Critical', 'critical', 'Hospital oxygen falling again', 'Keep oxygen stable while tracing the signal.', 'Pediatric ICU oxygen drops again.', 'The villain uses emotional pressure.'),
    tenSecondDanger('final-media', 140, 5, 'Medium', 'danger', 'Media frames hero as threat', 'Make a clean rescue choice that proves restraint.', 'Headlines ask if the hero is causing chaos.', 'Destruction hurts the final ending.'),
    tenSecondDanger('final-motive', 150, 5, 'Critical', 'critical', 'Motive clue unlocked', 'Connect black crown, linked systems, and multitasking pressure.', 'The villain says: “Too many powers. One mind.”', 'This reveals the motive.'),
    tenSecondDanger('final-mastermind', 160, 5, 'Critical', 'critical', 'Name the mastermind', 'Identify the villain behind the linked disasters.', 'The final signal points to the suspect board.', 'Tasks alone are not enough.'),
    tenSecondDanger('final-proof', 170, 5, 'Critical', 'critical', 'Prove Hero of the Day', 'Stop the signal and state the villain motive.', 'All linked events enter final countdown.', 'Finish tasks and solve villain/motive.')
  ]
};

for (const script of ROUND_SCRIPTS) {
  const existingTimes = new Set(script.dangers.map(danger => Number(danger.at)));
  for (const danger of TEN_SECOND_DANGER_EVENTS[script.round] || []) {
    if (!existingTimes.has(Number(danger.at))) {
      script.dangers.push(danger);
    }
  }
  script.dangers.sort((a, b) => a.at - b.at);
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, 500);
}

function publicSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    eventName: row.event_name,
    venue: row.venue,
    gameTitle: GAME_TITLE,
    gameSubtitle: GAME_SUBTITLE,
    status: row.status,
    currentRound: Number(row.current_round || 0),
    maxRounds: Number(row.max_rounds || MAX_ROUNDS),
    destruction: Number(row.destruction || 0),
    fatalities: Number(row.fatalities || 0),
    roundStartedAt: row.round_started_at,
    roundEndsAt: row.round_ends_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    sidekickTimeCostSeconds: SIDEKICK_TIME_COST_SECONDS
  };
}

function publicPlayer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sessionId: row.session_id,
    createdAt: row.created_at,
    checkedInAt: row.checked_in_at
  };
}

function getRoundScript(roundNumber) {
  return ROUND_SCRIPTS.find(item => item.round === Number(roundNumber)) || null;
}

function getRoundElapsedSeconds(session) {
  if (!session || session.status !== 'active' || !session.round_started_at) return 0;
  const start = new Date(session.round_started_at).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.min(ROUND_SECONDS, Math.floor((Date.now() - start) / 1000)));
}

function formatRoundTime(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = String(safe % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function publicRoundInfo(session) {
  const script = getRoundScript(session?.current_round);
  if (!script) return null;
  return {
    round: script.round,
    title: script.title,
    story: script.story,
    objective: script.objective,
    quiz: script.quiz
  };
}

function buildRoundDangers(session, includeUpcoming = false) {
  const script = getRoundScript(session?.current_round);
  if (!script || session.status !== 'active') return [];
  const elapsed = getRoundElapsedSeconds(session);
  return script.dangers
    .filter(danger => includeUpcoming || elapsed >= danger.at)
    .sort((a, b) => b.at - a.at)
    .map(danger => ({
      id: `r${script.round}-${danger.id}`,
      roundNumber: script.round,
      roundTitle: script.title,
      headline: danger.headline,
      message: danger.message,
      task: danger.task,
      priority: danger.priority,
      severity: danger.severity,
      consequence: danger.consequence,
      appearsAtSecond: danger.at,
      appearsAtLabel: formatRoundTime(danger.at),
      secondsRemainingWhenAppears: Math.max(0, ROUND_SECONDS - danger.at),
      status: elapsed >= danger.at ? 'active' : 'upcoming'
    }));
}

function buildAutoBroadcasts(session) {
  if (!session?.round_started_at) return [];
  const startMs = new Date(session.round_started_at).getTime();
  return buildRoundDangers(session, false).map(danger => ({
    id: `auto-${danger.id}`,
    roundNumber: danger.roundNumber,
    message: `${danger.headline}: ${danger.message}`,
    severity: danger.severity,
    createdAt: new Date(startMs + danger.appearsAtSecond * 1000).toISOString(),
    auto: true
  }));
}

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.error('\nMissing DATABASE_URL. Add a PostgreSQL connection string before starting the app.\n');
    process.exit(1);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      host_code TEXT NOT NULL,
      event_name TEXT NOT NULL DEFAULT 'Heroes & Villains',
      venue TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'rsvp',
      current_round INTEGER NOT NULL DEFAULT 0,
      max_rounds INTEGER NOT NULL DEFAULT 5,
      destruction INTEGER NOT NULL DEFAULT 0,
      fatalities INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      round_started_at TIMESTAMPTZ,
      round_ends_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ
    );
  `);

  await query(`ALTER TABLE sessions ALTER COLUMN event_name SET DEFAULT 'Heroes & Villains';`);

  await query(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'rsvped',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checked_in_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS broadcasts (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS player_actions (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 0,
      power TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sidekick_actions (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 0,
      task TEXT NOT NULL DEFAULT '',
      time_cost_seconds INTEGER NOT NULL DEFAULT 30,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, player_id, round_number)
    );
  `);
}

async function requireHostCode(sessionId, hostCode) {
  const code = cleanText(hostCode);
  const sessionResult = await query('SELECT * FROM sessions WHERE id=$1', [sessionId]);
  const session = sessionResult.rows[0];
  if (!session) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }
  if (session.host_code !== code) {
    const error = new Error('Incorrect host code.');
    error.status = 403;
    throw error;
  }
  return session;
}

function sendError(res, error) {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Something went wrong.' });
}

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/host', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/player', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('/api/health', async (_req, res) => {
  const now = await query('SELECT NOW() AS now');
  res.json({ ok: true, dbTime: now.rows[0].now });
});

app.get('/api/sessions/active', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM sessions
      WHERE status <> 'ended'
      ORDER BY created_at DESC
      LIMIT 25
    `);
    res.json({ sessions: result.rows.map(publicSession) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const eventName = cleanText(req.body.eventName, GAME_TITLE) || GAME_TITLE;
    const venue = cleanText(req.body.venue, '');
    const hostCode = cleanText(req.body.hostCode, '');
    if (hostCode.length < 3) {
      return res.status(400).json({ error: 'Host code must be at least 3 characters.' });
    }

    let session;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = nanoid(6).toUpperCase().replace(/[-_]/g, 'X');
      try {
        const result = await query(`
          INSERT INTO sessions (code, host_code, event_name, venue)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [code, hostCode, eventName, venue]);
        session = result.rows[0];
        break;
      } catch (error) {
        if (error.code !== '23505') throw error;
      }
    }

    if (!session) throw new Error('Could not create a unique session code.');
    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, 0, $2, 'info')
    `, [session.id, 'RSVP is open for Heroes & Villains. Check in after RSVP using the host code.']);

    res.status(201).json({ session: publicSession(session) });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/sessions/:code/state', async (req, res) => {
  try {
    const code = cleanText(req.params.code).toUpperCase();
    const sessionResult = await query('SELECT * FROM sessions WHERE code=$1', [code]);
    const session = sessionResult.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const [players, manualBroadcasts, actions, sidekickActions] = await Promise.all([
      query('SELECT * FROM players WHERE session_id=$1 ORDER BY created_at ASC', [session.id]),
      query('SELECT * FROM broadcasts WHERE session_id=$1 ORDER BY created_at DESC LIMIT 20', [session.id]),
      query(`
        SELECT pa.*, p.name AS player_name
        FROM player_actions pa
        JOIN players p ON p.id = pa.player_id
        WHERE pa.session_id=$1
        ORDER BY pa.created_at DESC
        LIMIT 25
      `, [session.id]),
      query(`
        SELECT sa.*, p.name AS player_name
        FROM sidekick_actions sa
        JOIN players p ON p.id = sa.player_id
        WHERE sa.session_id=$1
        ORDER BY sa.created_at DESC
        LIMIT 25
      `, [session.id])
    ]);

    const manualBroadcastRows = manualBroadcasts.rows.map(row => ({
      id: row.id,
      roundNumber: row.round_number,
      message: row.message,
      severity: row.severity,
      createdAt: row.created_at,
      auto: false
    }));
    const broadcasts = [...buildAutoBroadcasts(session), ...manualBroadcastRows]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 14);

    res.json({
      session: publicSession(session),
      roundInfo: publicRoundInfo(session),
      activeDangers: buildRoundDangers(session, false),
      upcomingDangers: buildRoundDangers(session, true),
      players: players.rows.map(publicPlayer),
      broadcasts,
      actions: actions.rows.map(row => ({
        id: row.id,
        playerId: row.player_id,
        playerName: row.player_name,
        roundNumber: row.round_number,
        power: row.power,
        target: row.target,
        createdAt: row.created_at
      })),
      sidekickActions: sidekickActions.rows.map(row => ({
        id: row.id,
        playerId: row.player_id,
        playerName: row.player_name,
        roundNumber: row.round_number,
        task: row.task,
        timeCostSeconds: row.time_cost_seconds,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/rsvp', async (req, res) => {
  try {
    const sessionCode = cleanText(req.body.sessionCode).toUpperCase();
    const name = cleanText(req.body.name);
    if (!sessionCode) return res.status(400).json({ error: 'Choose a session first.' });
    if (name.length < 2) return res.status(400).json({ error: 'Enter a player name.' });

    const sessionResult = await query(`
      SELECT * FROM sessions
      WHERE code=$1 AND status <> 'ended'
    `, [sessionCode]);
    const session = sessionResult.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found or already ended.' });

    const playerId = nanoid(18);
    const playerResult = await query(`
      INSERT INTO players (id, session_id, name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [playerId, session.id, name]);

    res.status(201).json({
      player: publicPlayer(playerResult.rows[0]),
      session: publicSession(session)
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/players/:id', async (req, res) => {
  try {
    const playerId = cleanText(req.params.id);
    const playerResult = await query(`
      SELECT p.*, s.code AS session_code
      FROM players p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.id=$1
    `, [playerId]);
    const row = playerResult.rows[0];
    if (!row) return res.status(404).json({ error: 'Player not found.' });
    res.json({
      player: publicPlayer(row),
      sessionCode: row.session_code
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/checkin', async (req, res) => {
  try {
    const playerId = cleanText(req.body.playerId);
    const hostCode = cleanText(req.body.hostCode);
    const playerResult = await query(`
      SELECT p.*, s.host_code, s.status AS session_status, s.code AS session_code, s.id AS sid
      FROM players p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.id=$1 AND s.status <> 'ended'
    `, [playerId]);
    const row = playerResult.rows[0];
    if (!row) return res.status(404).json({ error: 'RSVP not found or session ended.' });
    if (row.host_code !== hostCode) return res.status(403).json({ error: 'Incorrect host code.' });

    const updated = await query(`
      UPDATE players
      SET status='checked_in', checked_in_at=COALESCE(checked_in_at, NOW())
      WHERE id=$1
      RETURNING *
    `, [playerId]);

    res.json({
      player: publicPlayer(updated.rows[0]),
      sessionCode: row.session_code,
      sessionStatus: row.session_status
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/start', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const roundEndsAtSql = `NOW() + INTERVAL '${ROUND_SECONDS} seconds'`;
    const result = await query(`
      UPDATE sessions
      SET status='active', current_round=1, started_at=COALESCE(started_at, NOW()),
          round_started_at=NOW(), round_ends_at=${roundEndsAtSql}
      WHERE id=$1
      RETURNING *
    `, [session.id]);

    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, 1, 'Round 1 has started. Auto dangers now appear every 10 seconds.', 'danger')
    `, [session.id]);

    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/next-round', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    if (session.status !== 'active') return res.status(400).json({ error: 'Start the game first.' });
    if (session.current_round >= session.max_rounds) {
      return res.status(400).json({ error: 'Round 5 is the final round. End the game when ready.' });
    }
    const nextRound = Number(session.current_round) + 1;
    const result = await query(`
      UPDATE sessions
      SET current_round=$2, round_started_at=NOW(), round_ends_at=NOW() + INTERVAL '${ROUND_SECONDS} seconds'
      WHERE id=$1
      RETURNING *
    `, [session.id, nextRound]);

    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, $2, $3, 'danger')
    `, [session.id, nextRound, `Round ${nextRound} has started. Auto dangers now appear every 10 seconds.`]);

    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/end', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const result = await query(`
      UPDATE sessions
      SET status='ended', ended_at=NOW(), round_ends_at=NULL
      WHERE id=$1
      RETURNING *
    `, [session.id]);
    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, $2, 'Game ended. Prepare final hero result.', 'info')
    `, [session.id, session.current_round || 0]);
    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/reset', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const result = await query(`
      UPDATE sessions
      SET status='rsvp', current_round=0, destruction=0, fatalities=0,
          started_at=NULL, round_started_at=NULL, round_ends_at=NULL, ended_at=NULL
      WHERE id=$1
      RETURNING *
    `, [session.id]);
    await query('UPDATE players SET status=$2, checked_in_at=NULL WHERE session_id=$1', [session.id, 'rsvped']);
    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, 0, 'Session reset. RSVP is open again.', 'info')
    `, [session.id]);
    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/broadcast', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const message = cleanText(req.body.message);
    const severity = ['info', 'better', 'danger', 'critical'].includes(req.body.severity) ? req.body.severity : 'info';
    if (message.length < 3) return res.status(400).json({ error: 'Broadcast message is too short.' });
    const result = await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [session.id, session.current_round || 0, message, severity]);
    res.status(201).json({ broadcast: result.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/meters', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const destructionDelta = Number(req.body.destructionDelta || 0);
    const fatalitiesDelta = Number(req.body.fatalitiesDelta || 0);
    const destructionSet = req.body.destruction;
    const fatalitiesSet = req.body.fatalities;

    const nextDestruction = Number.isFinite(Number(destructionSet))
      ? Number(destructionSet)
      : Number(session.destruction) + destructionDelta;
    const nextFatalities = Number.isFinite(Number(fatalitiesSet))
      ? Number(fatalitiesSet)
      : Number(session.fatalities) + fatalitiesDelta;

    const result = await query(`
      UPDATE sessions
      SET destruction=GREATEST(0, LEAST(100, $2)),
          fatalities=GREATEST(0, LEAST(100, $3))
      WHERE id=$1
      RETURNING *
    `, [session.id, nextDestruction, nextFatalities]);

    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/actions', async (req, res) => {
  try {
    const playerId = cleanText(req.body.playerId);
    const power = cleanText(req.body.power);
    const target = cleanText(req.body.target, '');
    if (!power) return res.status(400).json({ error: 'Choose a power first.' });

    const playerResult = await query(`
      SELECT p.*, s.status AS session_status, s.current_round
      FROM players p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.id=$1 AND s.status <> 'ended'
    `, [playerId]);
    const player = playerResult.rows[0];
    if (!player) return res.status(404).json({ error: 'Player/session not found.' });
    if (player.status !== 'checked_in') return res.status(403).json({ error: 'Check in before using powers.' });
    if (player.session_status !== 'active') return res.status(400).json({ error: 'Wait for the host to start the game.' });

    const result = await query(`
      INSERT INTO player_actions (session_id, player_id, round_number, power, target)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [player.session_id, playerId, player.current_round, power, target]);

    res.status(201).json({ action: result.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
});


app.post('/api/sidekick', async (req, res) => {
  try {
    const playerId = cleanText(req.body.playerId);
    const task = cleanText(req.body.task, 'Handle one urgent task');
    if (task.length < 3) return res.status(400).json({ error: 'Enter the task for your sidekick.' });

    const playerResult = await query(`
      SELECT p.*, s.status AS session_status, s.current_round, s.round_ends_at
      FROM players p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.id=$1 AND s.status <> 'ended'
    `, [playerId]);
    const player = playerResult.rows[0];
    if (!player) return res.status(404).json({ error: 'Player/session not found.' });
    if (player.status !== 'checked_in') return res.status(403).json({ error: 'Check in before calling the sidekick.' });
    if (player.session_status !== 'active') return res.status(400).json({ error: 'Wait for the host to start the game.' });
    if (!player.current_round || player.current_round < 1) return res.status(400).json({ error: 'Sidekick can only be used during a live round.' });

    try {
      const actionResult = await query(`
        INSERT INTO sidekick_actions (session_id, player_id, round_number, task, time_cost_seconds)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [player.session_id, playerId, player.current_round, task, SIDEKICK_TIME_COST_SECONDS]);

      const sessionResult = await query(`
        UPDATE sessions
        SET round_ends_at = CASE
          WHEN round_ends_at IS NULL THEN NULL
          ELSE GREATEST(NOW(), round_ends_at - ($2::int * INTERVAL '1 second'))
        END
        WHERE id=$1
        RETURNING *
      `, [player.session_id, SIDEKICK_TIME_COST_SECONDS]);

      await query(`
        INSERT INTO broadcasts (session_id, round_number, message, severity)
        VALUES ($1, $2, $3, 'danger')
      `, [player.session_id, player.current_round, `Sidekick used: ${task}. Time cost: ${SIDEKICK_TIME_COST_SECONDS} seconds.`]);

      res.status(201).json({
        sidekickAction: actionResult.rows[0],
        session: publicSession(sessionResult.rows[0])
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Sidekick already used this round. You get one sidekick call per round.' });
      }
      throw error;
    }
  } catch (error) {
    sendError(res, error);
  }
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`${GAME_TITLE} app running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
