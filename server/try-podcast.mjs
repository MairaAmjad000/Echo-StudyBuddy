import { generateStudyPack } from './src/lib/generate.js'
import { buildPodcastFromPack, PODCAST_LENGTHS, podcastAiAvailable } from './src/lib/podcast.js'

const text = `Data Communication

Chapter 1: Bandwidth and Latency
Bandwidth is the maximum amount of data a link can carry in one second, and it is measured in bits per second. Latency is the time a single message takes to travel from the sender to the receiver. Throughput is the amount of data that actually arrives each second, which is often lower than the bandwidth because of congestion and protocol overhead.
A link with high bandwidth and high latency feels fast for large files and slow for a conversation. This is why video calls need low latency rather than raw speed. Jitter is the variation in delay between packets, and it is what makes a voice call sound robotic.

Chapter 2: Switching
Circuit switching reserves a path for the whole conversation, so the delay is constant and predictable. Packet switching cuts the data into packets that share the network with everyone else, so it uses the link far better but makes no promises about delay. The internet is a packet switched network.
Store and forward switching means a node receives a whole packet before it sends it on. Cut through switching starts forwarding as soon as the destination address has been read.

Chapter 3: Error Detection
A checksum is a small value computed from the data so the receiver can tell whether the message was damaged on the way. Cyclic redundancy check is a stronger checksum built from polynomial division. Forward error correction adds enough redundant bits that the receiver can repair some damage instead of asking for a retransmission.
Automatic repeat request is the family of rules where the receiver asks for a packet again when it fails a check.

Chapter 4: Addressing
An IP address names an interface so packets can be routed between networks. A media access control address names one network card and is only meaningful on a single link. Network address translation lets many devices share one public IP address by rewriting the addresses at the edge of the network.

Chapter 5: Congestion Control
Congestion control keeps the sender from overwhelming the network. Slow start begins with a small congestion window and doubles it each round trip until a packet is lost. Congestion avoidance then grows the window by one segment per round trip. When loss is detected the window is cut, and the sender backs off.
Quality of service marks some traffic as more urgent than the rest so a router can drop the least important packets first.`

const pack = generateStudyPack({ text })
console.log('sections:', pack.sections.length, 'cards:', pack.cards.length, 'questions:', pack.questions.length)
console.log('section titles:', pack.sections.map((s) => s.title).join(' | '))
console.log('ai key configured:', podcastAiAvailable())
console.log()

for (const length of PODCAST_LENGTHS) {
  const ep = buildPodcastFromPack({ material: { title: 'Data Communication', pack }, length })
  console.log(`\n===== ${length.id}: ${ep.title} | ${ep.segments.length} turns | ${ep.words} words | ${Math.round(ep.seconds / 60)} min =====`)
  for (const s of ep.segments) console.log(`${s.speaker === 'echo' ? 'ECHO' : 'MILO'}: ${s.text}`)
}
