export interface TalkChunk { id: string; group: string; en: string; ko: string }
// 목록 순서는 저장된 id와 연결된다. 새 표현은 각 목록 끝에 추가한다.
const groups: Record<string, string> = {
  daily: `How was your day?|오늘 하루 어땠어요?
I had a good day.|좋은 하루였어요.
I feel a bit tired.|조금 피곤해요.
I usually get up early.|보통 일찍 일어나요.
I like to cook.|요리하는 걸 좋아해요.
I went for a walk.|산책하러 갔어요.
I stayed home today.|오늘 집에 있었어요.
I spent time with my family.|가족과 시간을 보냈어요.
I watched a movie.|영화를 봤어요.
I listened to music.|음악을 들었어요.
I need a short break.|잠깐 쉬어야겠어요.
That sounds fun.|재미있겠어요.
What do you like to do?|뭘 하는 걸 좋아해요?
Let me think.|생각해 볼게요.
I'm not sure yet.|아직 잘 모르겠어요.
Can you say that again?|다시 말해 줄 수 있어요?
I prefer tea.|저는 차가 더 좋아요.
I'm looking forward to it.|그게 기대돼요.
I tried something new.|새로운 걸 해 봤어요.
It made me happy.|그 덕분에 기분이 좋았어요.`,
  work: `I work with a small team.|작은 팀과 일해요.
I'm working on a project.|프로젝트를 진행하고 있어요.
I have a meeting today.|오늘 회의가 있어요.
I need to check my schedule.|일정을 확인해야 해요.
Can we talk later?|나중에 이야기할 수 있어요?
I have a quick question.|짧게 질문할 게 있어요.
Let me check first.|먼저 확인할게요.
I will send you an update.|진행 상황을 보내 드릴게요.
We use an AI tool.|저희는 AI 도구를 써요.
It saves us time.|그 덕분에 시간이 절약돼요.
I want to learn more.|더 배우고 싶어요.
Could you show me how?|방법을 보여 주실 수 있어요?
This is new to me.|이건 저한테 처음이에요.
I agree with that.|그 말에 동의해요.
I see your point.|무슨 뜻인지 알겠어요.
We need more time.|시간이 더 필요해요.
I finished the first part.|첫 부분을 마쳤어요.
I'm ready to start.|시작할 준비가 됐어요.
What is the next step?|다음 단계는 뭔가요?
Thanks for your help.|도와주셔서 고마워요.`,
  money: `I'm learning about investing.|투자에 대해 배우고 있어요.
I think about the long term.|장기적인 관점으로 생각해요.
I want to understand the risks.|위험을 이해하고 싶어요.
I have a simple plan.|간단한 계획이 있어요.
I check my budget.|예산을 확인해요.
I try to save regularly.|꾸준히 저축하려고 해요.
I keep some cash for emergencies.|비상시에 쓸 현금을 조금 둬요.
I read the financial news.|금융 뉴스를 읽어요.
I don't understand this term.|이 용어를 이해하지 못했어요.
What does that mean?|그건 무슨 뜻인가요?
Could you give a simple example?|쉬운 예를 들어 주실 수 있어요?
I avoid rushing.|서두르지 않으려고 해요.
My goals may change.|제 목표는 바뀔 수도 있어요.
I want to compare the costs.|비용을 비교해 보고 싶어요.
I need to learn about taxes.|세금에 대해 배워야 해요.
I'm planning for retirement.|은퇴를 위한 계획을 세우고 있어요.
Diversification is new to me.|분산 투자는 저에게 생소해요.
I look at the fees.|수수료를 살펴봐요.
Nothing is guaranteed.|보장되는 건 없어요.
I make my own decisions.|제 결정은 제가 내려요.`,
  'biz-standup': `Here is a quick update.|진행 상황을 짧게 알려 드릴게요.
We finished the task.|그 일을 끝냈어요.
The work is on track.|일이 계획대로 진행되고 있어요.
We are a little behind.|조금 늦어지고 있어요.
I need help with this.|이 부분은 도움이 필요해요.
The main issue is timing.|주된 문제는 일정이에요.
We have one open question.|아직 해결하지 못한 질문이 하나 있어요.
I will check with the team.|팀에 확인할게요.
We can finish it this week.|이번 주에 끝낼 수 있어요.
The next task is testing.|다음 일은 테스트예요.
There are no major problems.|큰 문제는 없어요.
I have one concern.|걱정되는 점이 하나 있어요.
Let's set a deadline.|마감일을 정해 봐요.
Who is handling this?|이 일은 누가 담당하나요?
I can take that task.|제가 그 일을 맡을 수 있어요.
We are waiting for a reply.|답변을 기다리고 있어요.
Please keep us updated.|진행 상황을 계속 알려 주세요.
That's all from me.|제 보고는 여기까지예요.
Do you have any questions?|질문이 있으신가요?
We'll follow up tomorrow.|내일 이어서 확인할게요.`,
  'biz-negotiation': `Could we discuss the price?|가격을 이야기해 볼 수 있을까요?
That's above our budget.|저희 예산보다 높아요.
Is there any flexibility?|조정할 여지가 있나요?
Could you explain the cost?|비용을 설명해 주실 수 있나요?
We need a better option.|더 나은 선택지가 필요해요.
What is included?|무엇이 포함되나요?
Does that include delivery?|배송도 포함되나요?
We can offer a longer contract.|더 긴 계약을 제안할 수 있어요.
Let's find a fair solution.|공정한 해결책을 찾아봐요.
We value this partnership.|저희는 이 협력 관계를 소중히 여겨요.
I need to review the terms.|조건을 검토해야 해요.
Could you send a quote?|견적을 보내 주실 수 있나요?
That sounds reasonable.|합리적으로 들려요.
We need to compare options.|선택지를 비교해야 해요.
Can we adjust the quantity?|수량을 조정할 수 있나요?
What is the payment schedule?|대금 지급 일정은 어떻게 되나요?
Please put that in writing.|그 내용을 문서로 남겨 주세요.
I cannot confirm it today.|오늘은 확정할 수 없어요.
Let me discuss it internally.|내부에서 논의해 볼게요.
We hope to reach an agreement.|합의에 이르기를 바라요.`,
  'biz-presentation-qa': `Thank you for the question.|질문해 주셔서 고마워요.
Let me explain that part.|그 부분을 설명할게요.
The main goal is clear.|주된 목표는 명확해요.
Here is one example.|예를 하나 들어 볼게요.
We tested the idea.|그 아이디어를 시험해 봤어요.
The results look promising.|결과가 긍정적으로 보여요.
There are some limits.|몇 가지 한계가 있어요.
We need more data.|자료가 더 필요해요.
I don't have that detail yet.|그 세부 내용은 아직 없어요.
I will get back to you.|확인해서 다시 말씀드릴게요.
Could you clarify the question?|질문을 좀 더 풀어 주실 수 있나요?
Let me go back a step.|한 단계 앞부터 설명할게요.
This is the key point.|이것이 핵심이에요.
We have two options.|두 가지 선택지가 있어요.
The first option is simpler.|첫 번째 선택지가 더 간단해요.
The second option takes longer.|두 번째 선택지는 시간이 더 걸려요.
We are still reviewing it.|아직 검토하고 있어요.
That's a fair concern.|충분히 걱정할 만한 점이에요.
We'll address that issue.|그 문제를 다루겠습니다.
Does that answer your question?|질문에 답이 됐나요?`,
  'biz-ai-adoption': `We could try a small pilot.|작은 시범 운영을 해 볼 수 있어요.
What problem would it solve?|어떤 문제를 해결할 수 있나요?
We should start small.|작게 시작하는 게 좋겠어요.
People still need to review it.|사람의 검토가 여전히 필요해요.
We must protect private data.|개인 데이터를 보호해야 해요.
The tool can make mistakes.|그 도구도 실수할 수 있어요.
We need clear rules.|명확한 규칙이 필요해요.
Let's measure the results.|결과를 측정해 봐요.
It may save some time.|시간이 조금 절약될 수 있어요.
I understand your concern.|걱정하시는 점을 이해해요.
We can test it safely.|안전하게 시험해 볼 수 있어요.
We need training first.|먼저 교육이 필요해요.
Who would use the tool?|누가 그 도구를 쓰나요?
What would it cost?|비용은 얼마나 들까요?
We should compare it with our current process.|현재 과정과 비교해 봐야 해요.
Let's collect feedback.|의견을 모아 봐요.
We can stop if it does not help.|도움이 안 되면 중단할 수 있어요.
I would like to see a demo.|시연을 보고 싶어요.
We should check the source.|출처를 확인해야 해요.
The final decision is ours.|최종 결정은 저희가 해요.`,
  'biz-smalltalk': `It's nice to meet you.|만나서 반가워요.
How was your trip?|오시는 길은 어땠나요?
Did you arrive yesterday?|어제 도착하셨나요?
Is this your first visit?|이번이 첫 방문인가요?
I hope you had a good rest.|잘 쉬셨기를 바라요.
Would you like some water?|물 좀 드릴까요?
The weather is pleasant today.|오늘 날씨가 좋네요.
I have heard about your team.|당신 팀 이야기를 들었어요.
What do you do outside work?|일 외에는 뭘 하시나요?
I enjoy walking in my free time.|여가 시간에 걷는 걸 좋아해요.
That sounds interesting.|흥미롭게 들리네요.
How long will you stay?|얼마나 머무르시나요?
Have you tried the local food?|현지 음식을 드셔 보셨나요?
I can suggest a nearby place.|근처 장소를 알려 드릴 수 있어요.
The office is close by.|사무실은 가까이에 있어요.
Please make yourself comfortable.|편하게 계세요.
I'm glad we could meet.|만날 수 있어서 기뻐요.
We have some time before the meeting.|회의 전까지 시간이 조금 있어요.
Shall we get started?|시작해 볼까요?
I look forward to working with you.|함께 일하는 게 기대돼요.`,
  'biz-escalation': `We found an issue.|문제를 발견했어요.
I want to explain what happened.|무슨 일이 있었는지 설명하고 싶어요.
The service is not working properly.|서비스가 제대로 작동하지 않아요.
We are checking the cause.|원인을 확인하고 있어요.
I'm sorry for the delay.|늦어져서 죄송해요.
We understand the impact.|어떤 영향이 있는지 이해하고 있어요.
We need a quick response.|빠른 답변이 필요해요.
Who should we contact?|누구에게 연락해야 하나요?
Could you look into this?|이 문제를 살펴봐 주실 수 있나요?
We have a temporary solution.|임시 해결책이 있어요.
The problem started this morning.|문제는 오늘 아침에 시작됐어요.
It affects part of the service.|서비스 일부에 영향을 줘요.
We'll share more details soon.|곧 자세한 내용을 공유할게요.
Please confirm you received this.|받으셨는지 확인해 주세요.
Our team is working on it.|저희 팀이 해결하고 있어요.
We need to set priorities.|우선순위를 정해야 해요.
Can we agree on a timeline?|일정에 합의할 수 있나요?
We'll provide regular updates.|정기적으로 진행 상황을 알려 드릴게요.
Thank you for your patience.|기다려 주셔서 고마워요.
Let's prevent this from happening again.|같은 일이 다시 생기지 않도록 해요.`,
  'biz-free': `What caught your attention recently?|최근에 어떤 것이 눈에 들어왔나요?
I read an article about AI.|AI에 관한 글을 읽었어요.
Technology is changing quickly.|기술이 빠르게 바뀌고 있어요.
I wonder how it will affect our work.|우리 일에 어떤 영향을 줄지 궁금해요.
I have not tried it yet.|아직 써 보지 않았어요.
It looks easy to use.|사용하기 쉬워 보여요.
What do you think about it?|그것에 대해 어떻게 생각하세요?
I have mixed feelings.|좋은 점과 걱정되는 점이 함께 있어요.
There are both benefits and risks.|장점과 위험이 모두 있어요.
Could you share your experience?|경험을 이야기해 주실 수 있나요?
I had a similar experience.|저도 비슷한 경험이 있어요.
That's a useful idea.|유용한 생각이네요.
I would like to try it.|써 보고 싶어요.
It depends on the situation.|상황에 따라 달라요.
We should keep learning.|계속 배워야 해요.
I'm curious about the future.|앞으로가 궁금해요.
Let's look at another example.|다른 예를 살펴봐요.
I see it differently.|저는 다르게 봐요.
That's worth discussing.|논의해 볼 만해요.
We can learn from each other.|서로에게 배울 수 있어요.`,
  'biz-custom': `I would like to discuss something.|의논하고 싶은 게 있어요.
Could we talk for a moment?|잠깐 이야기할 수 있을까요?
Here is the situation.|상황은 이래요.
I need your advice on the process.|진행 방법에 대한 의견이 필요해요.
What would be a good next step?|다음으로 뭘 하면 좋을까요?
Let me explain the background.|배경을 설명할게요.
I have a few questions.|질문이 몇 가지 있어요.
Could you tell me more?|좀 더 이야기해 주실 수 있나요?
I want to make sure I understand.|제가 제대로 이해했는지 확인하고 싶어요.
Let's check the details.|세부 내용을 확인해 봐요.
We have a common goal.|저희는 같은 목표가 있어요.
I can help with that part.|그 부분은 제가 도울 수 있어요.
Could we consider another option?|다른 선택지를 생각해 볼 수 있나요?
That might work.|그 방법이 통할 수도 있겠어요.
We need to think it through.|차근차근 생각해 봐야 해요.
I will prepare the information.|자료를 준비할게요.
Please let me know what you need.|필요한 것을 알려 주세요.
Can we confirm the plan?|계획을 확인할 수 있나요?
I appreciate your time.|시간 내 주셔서 고마워요.
Let's stay in touch.|계속 연락해요.`,
};
export const TALK_CHUNKS: TalkChunk[] = Object.entries(groups).flatMap(([group, rows]) => rows.split('\n').map((row, i) => { const [en, ko] = row.split('|'); return { id: `${group}-${String(i + 1).padStart(2, '0')}`, group, en, ko }; }));
export const CHUNK_MAP = new Map(TALK_CHUNKS.map(chunk => [chunk.id, chunk]));
