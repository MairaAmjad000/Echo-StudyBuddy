// Built-in sample course so the app is useful before anything is uploaded.
// It uses exactly the same shape that `generateStudyPack` returns for uploaded files.

const kp = (id, label, match, hint) => ({ id, label, match, hint })

const sections = [
  {
    id: 's1',
    title: 'Layers and Protocols',
    summary: [
      'Network communication is split into layers, and each layer solves one problem for the layer above it.',
      'In the TCP/IP model the application layer carries user data, the transport layer delivers it between the two end hosts, the network layer routes packets between networks, and the data link layer moves frames across one link.',
    ],
    groups: [
      {
        title: 'TCP/IP layers, top to bottom',
        items: [
          'Application layer: HTTP, DNS, SMTP',
          'Transport layer: TCP and UDP, end-to-end delivery',
          'Network layer: IP addressing and routing',
          'Data link layer: frames and MAC addresses, one hop at a time',
          'Physical layer: bits on the medium',
        ],
      },
    ],
    terms: [
      { term: 'Protocol', def: 'A set of rules that two devices follow to exchange data.' },
      { term: 'Transport layer', def: 'The layer responsible for end-to-end communication between two hosts.' },
    ],
    keyPoints: [
      kp('k1', 'Transport layer handles end-to-end delivery', ['transport', 'end to end'], 'The transport layer (TCP, UDP) delivers data between the two end hosts.'),
      kp('k2', 'Network layer routes packets', ['network layer', 'routing', 'route', 'ip'], 'The network layer addresses packets with IP and routes them between networks.'),
      kp('k3', 'Each layer solves one problem', ['layer', 'layers'], 'Communication is split into layers so each one can solve a single problem for the layer above.'),
    ],
  },
  {
    id: 's2',
    title: 'TCP Connection Setup',
    summary: [
      'TCP opens a connection with a three-way handshake before any data is sent.',
      "The client sends SYN with its starting sequence number. The server replies with SYN-ACK, which carries its own sequence number and acknowledges the client's. The client finishes with ACK.",
    ],
    groups: [{ title: 'Handshake steps', items: ['Client sends SYN', 'Server replies SYN-ACK', 'Client sends ACK and the connection is established'] }],
    terms: [{ term: 'Sequence number', def: 'A number each side picks at the start and attaches to its packets so lost or out-of-order packets can be detected.' }],
    keyPoints: [
      kp('k1', 'Client opens with SYN', ['syn'], 'The client starts the handshake by sending a SYN packet.'),
      kp('k2', 'Server answers with SYN-ACK', ['synack'], 'The server replies with SYN-ACK to say it received the SYN.'),
      kp('k3', 'Client finishes with ACK', ['ack'], 'The client sends a final ACK and the connection is established.'),
      kp('k4', 'Sequence numbers', ['sequence number', 'sequence', 'seq'], 'Each side picks a sequence number and sends it with these packets, which is how a lost packet gets noticed.'),
    ],
  },
  {
    id: 's3',
    title: 'Transmission Media',
    summary: ['Transmission media is the physical path through which data travels from sender to receiver.'],
    groups: [
      { title: 'Guided media', items: ['Twisted pair cable', 'Coaxial cable', 'Fiber optic cable'] },
      { title: 'Unguided media', items: ['Radio waves', 'Microwaves', 'Infrared'] },
    ],
    terms: [
      { term: 'Guided media', def: 'Media where the signal travels along a physical cable.' },
      { term: 'Unguided media', def: 'Media where the signal travels through the air or space with no cable.' },
    ],
    keyPoints: [
      kp('k1', 'Guided media use a cable', ['guided', 'cable', 'wire'], 'Guided media carry the signal along a physical cable: twisted pair, coaxial or fiber optic.'),
      kp('k2', 'Unguided media travel through the air', ['unguided', 'wireless', 'air', 'radio', 'microwave'], 'Unguided media send the signal through the air: radio waves, microwaves and infrared.'),
      kp('k3', 'Fiber optic carries light', ['fiber', 'fibre', 'light'], 'Fiber optic cable carries data as pulses of light through glass.'),
    ],
  },
  {
    id: 's4',
    title: 'Signal and Encoding',
    summary: [
      'Data is turned into signals before it travels. Analog signals vary continuously, while digital signals use a fixed set of levels.',
      'Encoding maps bits to signal changes. Manchester encoding, for example, puts a transition in the middle of every bit.',
    ],
    groups: [
      {
        title: 'Key ideas',
        items: ['Analog signal: a continuous wave', 'Digital signal: discrete levels', 'Bandwidth: the range of frequencies a medium carries', 'Manchester encoding: a transition in the middle of each bit'],
      },
    ],
    terms: [{ term: 'Bandwidth', def: 'The range of frequencies a medium can carry. It limits how fast data can be sent.' }],
    keyPoints: [
      kp('k1', 'Analog versus digital', ['analog', 'digital'], 'Analog signals vary continuously. Digital signals use a fixed set of levels.'),
      kp('k2', 'Encoding maps bits to signals', ['encoding', 'encode', 'manchester'], 'Encoding turns bits into signal changes, for example Manchester encoding.'),
      kp('k3', 'Bandwidth limits speed', ['bandwidth', 'frequencies', 'frequency'], 'Bandwidth is the range of frequencies a medium carries and it limits how fast data can be sent.'),
    ],
  },
  {
    id: 's5',
    title: 'Multiplexing',
    summary: ['Multiplexing lets several signals share one link. The receiver separates them again at the other end.'],
    groups: [
      {
        title: 'Three common types',
        items: ['FDM: each signal gets its own frequency band', 'TDM: each signal gets a repeating time slot', 'WDM: each signal gets its own wavelength of light, used on fiber'],
      },
    ],
    terms: [
      { term: 'Multiplexing', def: 'Sharing one link between several signals.' },
      { term: 'TDM', def: 'A method where each signal gets the whole link for a short, repeating time slot.' },
    ],
    keyPoints: [
      kp('k1', 'Several signals share one link', ['multiplexing', 'share', 'shared', 'one link'], 'Multiplexing lets several signals share a single link.'),
      kp('k2', 'FDM splits by frequency', ['fdm', 'frequency'], 'FDM gives each signal its own frequency band.'),
      kp('k3', 'TDM splits by time', ['tdm', 'time slot', 'time'], 'TDM gives each signal a repeating time slot.'),
    ],
  },
  {
    id: 's6',
    title: 'Switching',
    summary: [
      'Switching decides how data moves through a network of many links. Circuit switching reserves a path for the whole call.',
      'Packet switching splits data into packets that are routed independently, so links are shared.',
    ],
    groups: [
      { title: 'Packet switching comes in two kinds', items: ['Datagram: every packet is routed on its own', 'Virtual circuit: a path is set up first and all packets follow it'] },
    ],
    terms: [
      { term: 'Circuit switching', def: 'A method that reserves a dedicated path for the whole call.' },
      { term: 'Packet switching', def: 'A method that splits data into packets and routes each one independently.' },
    ],
    keyPoints: [
      kp('k1', 'Circuit switching reserves a path', ['circuit', 'dedicated', 'reserve', 'reserved'], 'Circuit switching reserves a dedicated path for the whole call.'),
      kp('k2', 'Packet switching splits data into packets', ['packet', 'packets'], 'Packet switching splits data into packets that are routed independently.'),
      kp('k3', 'Virtual circuit sets up a path first', ['virtual circuit', 'datagram'], 'A virtual circuit sets up a path before data is sent. A datagram network routes each packet alone.'),
    ],
  },
  {
    id: 's7',
    title: 'Error Detection',
    summary: [
      'Errors creep in during transmission, so the sender adds extra bits that let the receiver check the data.',
      'A parity bit is the simplest check. A checksum adds up the data, and a CRC divides it by an agreed polynomial and sends the remainder.',
    ],
    groups: [{ title: 'Methods, simple to strong', items: ['Parity bit', 'Checksum', 'Cyclic redundancy check (CRC)'] }],
    terms: [
      { term: 'Parity bit', def: 'An extra bit that makes the number of 1s even or odd. It detects a single-bit error but misses two flipped bits.' },
      { term: 'CRC', def: 'A check where the receiver divides the data by an agreed polynomial and compares the remainder.' },
    ],
    keyPoints: [
      kp('k1', 'Extra bits let the receiver check data', ['error', 'errors', 'detect', 'detection', 'extra bits'], 'The sender adds extra bits so the receiver can detect errors.'),
      kp('k2', 'Parity bit', ['parity'], 'A parity bit detects a single-bit error but misses two flipped bits.'),
      kp('k3', 'CRC uses polynomial division', ['crc', 'cyclic', 'polynomial', 'remainder'], 'CRC divides the data by an agreed polynomial and compares the remainder.'),
    ],
  },
  {
    id: 's8',
    title: 'Flow and Access Control',
    summary: [
      'Flow control stops a fast sender from overwhelming a slow receiver. The sliding window protocol lets the sender transmit several frames before it needs an acknowledgment.',
      'On a shared link, CSMA/CD makes devices listen before sending and back off when frames collide.',
    ],
    groups: [{ title: 'CSMA/CD in four steps', items: ['Listen to see whether the line is free', 'Send if it is free', 'If two devices collide, both stop', 'Each waits a random time and tries again'] }],
    terms: [
      { term: 'CSMA/CD', def: 'Carrier Sense Multiple Access with Collision Detection. A device listens before it sends. If two send at once, both detect the collision, stop, wait a random time and try again.' },
      { term: 'Sliding window', def: 'A protocol that lets the sender transmit several frames before waiting for an acknowledgment.' },
    ],
    keyPoints: [
      kp('k1', 'Flow control protects a slow receiver', ['flow control', 'overwhelm', 'slow receiver', 'fast sender'], 'Flow control stops a fast sender from overwhelming a slow receiver.'),
      kp('k2', 'Sliding window', ['sliding window', 'window'], 'The sliding window lets the sender transmit several frames before waiting for an acknowledgment.'),
      kp('k3', 'CSMA/CD listens, detects collisions, backs off', ['csma', 'collision', 'backoff', 'listen'], 'CSMA/CD listens before sending, detects collisions, then waits a random time before retrying.'),
    ],
  },
]

const card = (id, sectionId, q, a) => ({ id, sectionId, q, a })
const cards = [
  card('c1', 's1', 'Which layer is responsible for end-to-end communication?', 'The transport layer (TCP, UDP).'),
  card('c2', 's1', 'What does the network layer do?', 'It addresses packets with IP and routes them between networks.'),
  card('c3', 's2', 'What are the three steps of the TCP handshake?', 'SYN from the client, SYN-ACK from the server, ACK from the client.'),
  card('c4', 's2', 'What does a SYN-ACK packet tell the client?', 'That the server received the SYN and is ready to open the connection.'),
  card('c5', 's2', 'Why do both sides send sequence numbers?', 'So lost, duplicated or out-of-order packets can be detected.'),
  card('c6', 's3', 'What is transmission media?', 'The physical path through which data travels from sender to receiver.'),
  card('c7', 's3', 'Name two guided transmission media.', 'Twisted pair cable and fiber optic cable. Coaxial cable also counts.'),
  card('c8', 's3', 'Why are microwaves called unguided media?', 'Because the signal travels through the air with no cable to guide it.'),
  card('c9', 's4', 'What is bandwidth?', 'The range of frequencies a medium can carry. It limits how fast data can be sent.'),
  card('c10', 's4', 'How does Manchester encoding represent a bit?', 'With a transition in the middle of the bit period.'),
  card('c11', 's5', 'What is multiplexing?', 'Sharing one link between several signals.'),
  card('c12', 's5', 'How does TDM share a link?', 'Each signal gets the whole link for a short, repeating time slot.'),
  card('c13', 's6', 'How do circuit and packet switching differ?', 'Circuit switching reserves a dedicated path for the whole call. Packet switching splits data into packets that are routed independently.'),
  card('c14', 's6', 'What is a virtual circuit?', 'A packet-switched path set up before data is sent, so all packets follow the same route.'),
  card('c15', 's7', 'What does a parity bit detect?', 'Any single-bit error. It misses errors that flip two bits.'),
  card('c16', 's7', 'What does a CRC check?', 'That the remainder of dividing the data by an agreed polynomial matches the one that was sent.'),
  card('c17', 's8', 'What is CSMA/CD?', 'Carrier Sense Multiple Access with Collision Detection. A device listens before it sends. If two send at once, both detect the collision, stop, wait a random time and try again.'),
  card('c18', 's8', 'What does the sliding window protocol allow?', 'The sender to transmit several frames before waiting for an acknowledgment.'),
]

const q = (id, sectionId, text, options, answer, why) => ({ id, sectionId, q: text, options, answer, why })
const questions = [
  q('q1', 's1', 'Which layer is responsible for end-to-end communication?', ['Application layer', 'Transport layer', 'Network layer', 'Data link layer'], 1, 'The transport layer (TCP, UDP) handles delivery between the two end hosts. The network layer only routes packets between networks.'),
  q('q2', 's1', 'Which layer routes packets between different networks?', ['Transport layer', 'Network layer', 'Data link layer', 'Physical layer'], 1, 'The network layer uses IP addresses to route packets from one network to the next.'),
  q('q3', 's2', 'In the TCP handshake, which packet does the client send last?', ['SYN', 'SYN-ACK', 'ACK', 'FIN'], 2, 'The client opens with SYN, the server answers with SYN-ACK, and the client finishes with ACK.'),
  q('q4', 's2', 'What is the main job of sequence numbers?', ['Encrypt the data', 'Detect lost or out-of-order packets', 'Choose the route', 'Set the sending speed'], 1, 'Sequence numbers let each side notice packets that are missing, repeated or out of order.'),
  q('q5', 's3', 'Which guided medium carries data as pulses of light?', ['Twisted pair cable', 'Coaxial cable', 'Fiber optic cable', 'Microwave link'], 2, 'Fiber optic cable sends light through glass. Microwaves are unguided, so they travel through the air.'),
  q('q6', 's3', 'Which of these is unguided media?', ['Coaxial cable', 'Fiber optic cable', 'Twisted pair cable', 'Radio waves'], 3, 'Radio waves travel through the air with no cable, so they are unguided.'),
  q('q7', 's4', 'What does Manchester encoding place in the middle of each bit?', ['A pause', 'A transition', 'A parity check', 'A carrier tone'], 1, 'Manchester encoding always has a transition in the middle of the bit period.'),
  q('q8', 's4', 'What does bandwidth limit?', ['How fast data can be sent', 'How far a cable can reach', 'How many layers are used', 'Which protocol is chosen'], 0, 'Bandwidth is the range of frequencies a medium carries, so it limits the data rate.'),
  q('q9', 's5', 'Which technique gives each signal a repeating time slot?', ['FDM', 'TDM', 'WDM', 'ARQ'], 1, 'Time-division multiplexing (TDM) shares the link by time.'),
  q('q10', 's5', 'WDM is mostly used on which medium?', ['Fiber optic cable', 'Twisted pair cable', 'Radio links', 'Coaxial cable only'], 0, 'Wavelength-division multiplexing sends several wavelengths of light down one fiber.'),
  q('q11', 's6', 'Which switching method reserves a dedicated path for the whole call?', ['Circuit switching', 'Packet switching', 'Datagram switching', 'Message queuing'], 0, 'Circuit switching sets up and holds a dedicated path until the call ends.'),
  q('q12', 's6', 'In packet switching, how is data sent?', ['As one stream on a reserved path', 'As small packets that can take different routes', 'As a single large frame', 'Only after the receiver replies'], 1, 'Packet switching splits data into packets that are routed independently.'),
  q('q13', 's7', 'Which method detects a single-bit error but misses two flipped bits?', ['CRC', 'Checksum', 'Parity bit', 'Hamming code'], 2, 'A parity bit only tracks whether the count of 1s is even or odd, so two flips cancel out.'),
  q('q14', 's7', 'What does a CRC compare at the receiver?', ['A remainder from polynomial division', 'The packet length', "The sender's IP address", 'The number of hops'], 0, 'The receiver divides the data by the agreed polynomial and checks the remainder.'),
  q('q15', 's8', 'What does a CSMA/CD device do when it detects a collision?', ['Keeps sending', 'Stops, waits a random time, then retries', 'Switches to Wi-Fi', 'Sends a SYN'], 1, 'Both devices stop, wait a random time and try again, so they are unlikely to collide twice.'),
  q('q16', 's8', 'What does the sliding window protocol allow?', ['Sending several frames before an acknowledgment', 'Sending one frame at a time', 'Skipping error checks', 'Encrypting frames'], 0, 'The window is the number of frames the sender may have outstanding at once.'),
]

export function makeSampleMaterial() {
  return {
    id: 'sample-datacom',
    title: 'Data Communication',
    type: 'sample',
    sample: true,
    status: 'ready',
    addedAt: Date.now(),
    pack: { sections, cards, questions },
  }
}

// Exported so the landing page can show the same content the real app uses.
export const SAMPLE_PACK = { sections, cards, questions }

export const emptyState = () => ({
  account: null, // { name, email, pass, createdAt }
  signedIn: false,
  materials: [],
  sectionsDone: {}, // materialId -> [sectionId]
  cardsEasy: {}, // materialId -> [cardId]; a key means the deck was studied
  quizLog: [], // { at, materialId, correct, total, defeated, fast }
  teachLog: [], // { at, materialId, sectionId, topic, score }
  xp: 0,
  xpLog: [], // { at, amount }
  studyDays: [], // YYYY-MM-DD
  activity: [], // { id, type, text, at }
  achievements: {}, // id -> unlockedAt
  settings: { reduceMotion: false, echoEnabled: true },
  lastStudied: null, // { materialId, sectionId }
})

/** Fills in believable progress so every page can be seen with data. Used by Settings > Load sample progress. */
export function demoProgress(materialId, now = Date.now()) {
  const DAY = 864e5
  const day = (n) => new Date(now - n * DAY).toLocaleDateString('en-CA')
  const xpLog = []
  const perDay = [90, 140, 60, 180, 110, 75, 160, 120, 95, 150, 70, 130, 100, 85, 170, 60, 140, 110, 90, 125, 80, 150]
  perDay.forEach((amount, i) => xpLog.push({ at: now - (i * 1.3 + 0.2) * DAY, amount }))
  xpLog.sort((a, b) => a.at - b.at)
  const xp = xpLog.reduce((n, e) => n + e.amount, 0)
  const at = (hoursAgo) => now - hoursAgo * 36e5
  return {
    sectionsDone: { [materialId]: ['s1', 's2', 's3'] },
    cardsEasy: { [materialId]: ['c1', 'c3', 'c4', 'c6', 'c7', 'c9', 'c10', 'c11', 'c12', 'c13', 'c15'] },
    quizLog: [
      { at: at(3), materialId, correct: 8, total: 10, defeated: false, fast: 5 },
      { at: at(30), materialId, correct: 6, total: 8, defeated: false, fast: 4 },
      { at: at(80), materialId, correct: 9, total: 10, defeated: true, fast: 7 },
    ],
    teachLog: [
      { at: at(26), materialId, sectionId: 's2', topic: 'TCP Connection Setup', score: 75 },
      { at: at(100), materialId, sectionId: 's3', topic: 'Transmission Media', score: 67 },
    ],
    xp,
    xpLog,
    studyDays: Array.from({ length: 14 }, (_, i) => day(13 - i)),
    activity: [
      { id: 'd1', type: 'quiz', text: 'Quiz completed. Score 80%', at: at(3) },
      { id: 'd2', type: 'teach', text: 'Teach Echo on TCP Connection Setup. Score 75%', at: at(26) },
      { id: 'd3', type: 'cards', text: 'Flashcards reviewed. 11 marked easy', at: at(28) },
      { id: 'd4', type: 'topic', text: 'Finished topic: Transmission Media', at: at(52) },
      { id: 'd5', type: 'upload', text: 'Notes generated from Data Communication', at: at(120) },
    ],
    lastStudied: { materialId, sectionId: 's4' },
  }
}
