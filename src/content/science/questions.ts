import type { ScienceUnit } from './units';

export interface ScienceQuestion {
  id: string;
  audience: 'both' | 'g3' | 'g5';
  unit: ScienceUnit;
  kind: 'choice' | 'ox';
  emoji: string;
  question: string;
  choices: string[];
  answer: number;
  explain: string;
  card: string;
  why?: string;
  experimentId?: string;
}

/** 보호자 확인 필요: 과학 문제 100개. 단원 출처는 docs/T08b-content-review.md. */
export const SCIENCE_QUESTIONS: ScienceQuestion[] = [
  {
    "id": "both-life-01",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "통사과가 물에 뜨는 까닭으로 알맞은 것은?",
    "choices": [
      "사과 속에 공기가 있는 공간이 있어서",
      "사과가 물을 모두 빨아들여서",
      "물이 사과를 밀어 주지 않아서",
      "사과는 무게가 전혀 없어서"
    ],
    "answer": 0,
    "explain": "사과 속에는 공기가 있는 작은 공간이 있어요. 그래서 통사과의 전체 밀도가 물보다 작아 물에 뜰 수 있어요.",
    "card": "통사과는 전체 밀도가 물보다 작아 물에 떠요.",
    "experimentId": "science-apple"
  },
  {
    "id": "both-life-02",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "동전을 물에 넣으면 보통 어디로 갈까요?",
    "choices": [
      "물 위로 떠올라요",
      "물 바닥으로 가요",
      "물 밖으로 날아가요",
      "물에 녹아 없어져요"
    ],
    "answer": 1,
    "explain": "동전에 쓰이는 금속은 물보다 밀도가 커요. 그래서 물속에서 가라앉아요.",
    "card": "동전은 보통 물에 가라앉아요.",
    "experimentId": "science-coin"
  },
  {
    "id": "both-life-03",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "빈 블록을 열린 쪽이 아래로 가게 물에 놓았어요. 안쪽에 남아 블록이 뜨는 데 도움을 주는 것은?",
    "choices": [
      "모래",
      "돌",
      "공기",
      "소금"
    ],
    "answer": 2,
    "explain": "블록 안에 공기가 갇힐 수 있어요. 공기가 있는 빈 공간은 블록 전체의 밀도를 낮춰 떠 있는 데 도움을 줘요.",
    "card": "공기가 갇힌 빈 공간은 물에 뜨는 데 도움을 줘요.",
    "experimentId": "science-block"
  },
  {
    "id": "both-life-04",
    "audience": "both",
    "unit": "life",
    "kind": "ox",
    "emoji": "🌈",
    "question": "아주 진한 소금물에서는 달걀이 뜰 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "소금이 많이 녹은 물은 맹물보다 밀도가 커요. 소금물의 밀도가 달걀보다 커지면 달걀이 떠요.",
    "card": "물에 녹은 소금은 물의 밀도를 높여요.",
    "experimentId": "science-egg"
  },
  {
    "id": "both-life-05",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "자석에 잘 붙는 물건은 무엇일까요?",
    "choices": [
      "나무 막대",
      "종이 조각",
      "고무줄",
      "철 클립"
    ],
    "answer": 3,
    "explain": "자석은 철로 된 물건을 끌어당겨요. 모든 금속이 자석에 잘 붙는 것은 아니에요.",
    "card": "자석은 철로 된 물건을 끌어당겨요.",
    "experimentId": "science-magnet-items"
  },
  {
    "id": "both-life-06",
    "audience": "both",
    "unit": "life",
    "kind": "ox",
    "emoji": "🌈",
    "question": "얇은 종이 한 장 너머의 철 클립도 자석이 끌어당길 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "자석의 힘은 얇은 종이를 사이에 두어도 작용할 수 있어요. 자석과 클립이 너무 멀어지면 힘이 약해져요.",
    "card": "자석의 힘은 얇은 종이 너머에도 작용해요.",
    "experimentId": "science-magnet-paper"
  },
  {
    "id": "both-life-07",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "자유롭게 도는 자석의 북쪽을 가리키는 극은?",
    "choices": [
      "북극",
      "남극",
      "동극",
      "서극"
    ],
    "answer": 0,
    "explain": "자석의 북극은 대체로 북쪽을 가리켜요. 지구 자체가 큰 자석처럼 작용하기 때문이에요.",
    "card": "나침반의 자석은 방향을 찾는 데 쓰여요.",
    "experimentId": "science-compass"
  },
  {
    "id": "both-life-08",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "고무줄을 튕길 때 소리를 내는 까닭은?",
    "choices": [
      "고무줄이 녹아서",
      "고무줄이 떨려서",
      "고무줄이 사라져서",
      "고무줄의 색이 바뀌어서"
    ],
    "answer": 1,
    "explain": "튕긴 고무줄은 빠르게 떨려요. 이 떨림이 주위 공기로 전달되어 소리를 들을 수 있어요.",
    "card": "소리가 나는 물체는 떨려요.",
    "experimentId": "science-rubber-sound"
  },
  {
    "id": "both-life-09",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "컵 전화기의 실을 곧게 펴면 소리가 잘 전해지는 까닭은?",
    "choices": [
      "실이 빛을 만들어서",
      "실이 물을 옮겨서",
      "실이 떨림을 전달해서",
      "실이 자석으로 바뀌어서"
    ],
    "answer": 2,
    "explain": "컵의 떨림이 팽팽한 실을 따라 전달돼요. 다른 컵도 떨리면서 소리를 내요.",
    "card": "실 같은 고체도 소리를 전달할 수 있어요.",
    "experimentId": "science-cup-phone"
  },
  {
    "id": "both-life-10",
    "audience": "both",
    "unit": "life",
    "kind": "ox",
    "emoji": "🌈",
    "question": "같은 유리컵을 두드릴 때 물이 많은 컵은 보통 더 높은 소리가 나요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "같은 컵을 두드리면 물이 많을수록 컵과 물이 더 느리게 떨려요. 그래서 보통 더 낮은 소리가 나요.",
    "card": "물 컵을 두드릴 때 물의 양에 따라 높낮이가 달라져요.",
    "experimentId": "science-water-sound"
  },
  {
    "id": "both-life-11",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "물체와 벽은 그대로 두고 손전등을 물체에 가까이 했어요. 그림자는 보통 어떻게 될까요?",
    "choices": [
      "완전히 없어져요",
      "항상 같은 크기예요",
      "물체 안으로 들어가요",
      "더 커져요"
    ],
    "answer": 3,
    "explain": "물체가 손전등에 가까워지면 더 넓게 퍼지는 빛을 가려요. 그래서 벽에 생기는 그림자가 커져요.",
    "card": "빛과 물체 사이의 거리가 그림자 크기에 영향을 줘요.",
    "experimentId": "science-shadow"
  },
  {
    "id": "both-life-12",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "물컵 옆에서 본 빨대가 꺾인 것처럼 보이는 까닭은?",
    "choices": [
      "빛의 진행 방향이 바뀌어서",
      "빨대가 실제로 잘려서",
      "물이 빛을 모두 없애서",
      "빨대가 자석이라서"
    ],
    "answer": 0,
    "explain": "빛이 물과 공기 사이를 지날 때 진행 방향이 바뀔 수 있어요. 이것을 빛의 굴절이라고 해요.",
    "card": "물과 공기 사이에서 빛이 굴절해요.",
    "experimentId": "science-straw-light"
  },
  {
    "id": "both-life-13",
    "audience": "both",
    "unit": "life",
    "kind": "ox",
    "emoji": "🌈",
    "question": "흰빛은 한 가지 색의 빛으로만 이루어져 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "흰빛에는 여러 색의 빛이 섞여 있어요. 물 등을 지나며 색마다 다른 방향으로 굴절하면 무지개색이 보여요.",
    "card": "흰빛에는 여러 색의 빛이 섞여 있어요.",
    "experimentId": "science-rainbow"
  },
  {
    "id": "both-life-14",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "빨대로 종이관 안에 공기를 보내면 종이관이 움직여요. 무엇이 종이관을 밀까요?",
    "choices": [
      "종이의 색",
      "공기",
      "자석",
      "달빛"
    ],
    "answer": 1,
    "explain": "공기도 물체를 밀 수 있어요. 종이관 안으로 보낸 공기가 종이관을 앞으로 밀어요.",
    "card": "공기는 물체를 미는 힘을 줄 수 있어요.",
    "experimentId": "science-rocket"
  },
  {
    "id": "both-life-15",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "같은 종이 인형에 낙하산을 달면 보통 더 천천히 내려와요. 까닭은?",
    "choices": [
      "인형의 무게가 없어져서",
      "중력이 없어져서",
      "공기의 저항을 더 많이 받아서",
      "낙하산이 물을 만들어서"
    ],
    "answer": 2,
    "explain": "펼쳐진 낙하산은 공기의 저항을 많이 받아요. 이 힘이 아래로 떨어지는 움직임을 늦춰요.",
    "card": "낙하산은 공기의 저항을 이용해요.",
    "experimentId": "science-parachute"
  },
  {
    "id": "both-life-16",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "종이 비행기의 날개 모양만 비교하려고 해요. 같게 해야 할 것은?",
    "choices": [
      "날개의 모양까지 모두",
      "날아간 거리의 결과",
      "측정한 숫자",
      "종이와 던지는 방법"
    ],
    "answer": 3,
    "explain": "비교하려는 날개 모양만 바꾸고 다른 조건은 같게 해요. 그래야 거리 차이가 날개 모양과 관련 있는지 살펴볼 수 있어요.",
    "card": "공정한 비교는 바꿀 조건 하나를 정해요.",
    "experimentId": "science-plane"
  },
  {
    "id": "both-life-17",
    "audience": "both",
    "unit": "life",
    "kind": "ox",
    "emoji": "🌈",
    "question": "문지른 풍선은 작은 종이 조각을 전혀 끌어당길 수 없어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "풍선을 문지르면 정전기가 생길 수 있어요. 정전기의 힘이 작은 종이 조각을 끌어당겨요.",
    "card": "문지른 풍선에 정전기가 생길 수 있어요.",
    "experimentId": "science-static"
  },
  {
    "id": "both-life-18",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "레몬 전지에서 전류가 흐르도록 쓰는 금속은?",
    "choices": [
      "서로 다른 두 종류의 금속",
      "플라스틱 두 조각",
      "나무 두 조각",
      "종이 두 장"
    ],
    "answer": 0,
    "explain": "서로 다른 두 금속과 레몬즙을 이용하면 전지를 만들 수 있어요. 연결 방향과 재료에 따라 작은 발광 다이오드가 켜지지 않을 수도 있어요.",
    "card": "서로 다른 금속과 레몬즙으로 전지를 만들 수 있어요.",
    "experimentId": "science-lemon"
  },
  {
    "id": "both-life-19",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "식용유와 물을 섞고 기다리면 보통 어떻게 될까요?",
    "choices": [
      "둘 다 돌로 바뀌어요",
      "두 층으로 나뉘어요",
      "물만 없어져요",
      "항상 한 층으로 고르게 섞여요"
    ],
    "answer": 1,
    "explain": "식용유와 물은 잘 섞이지 않아요. 식용유는 물보다 밀도가 작아 보통 위층에 놓여요.",
    "card": "식용유와 물은 잘 섞이지 않아 층을 만들어요.",
    "experimentId": "science-oil"
  },
  {
    "id": "both-life-20",
    "audience": "both",
    "unit": "life",
    "kind": "choice",
    "emoji": "🌈",
    "question": "파란 색소 물과 노란 색소 물을 섞으면 보통 어떤 색으로 보일까요?",
    "choices": [
      "검은색",
      "흰색",
      "초록색",
      "빨간색"
    ],
    "answer": 2,
    "explain": "파란색과 노란색의 색소를 섞으면 보통 초록색으로 보여요. 색소의 종류와 양에 따라 색의 진하기는 달라질 수 있어요.",
    "card": "색소 물을 섞으면 다른 색으로 보일 수 있어요.",
    "experimentId": "science-color-water"
  },
  {
    "id": "g3-force-01",
    "audience": "g3",
    "unit": "g3-force",
    "kind": "choice",
    "emoji": "🛝",
    "question": "종이컵 네 개 위에 판을 놓고 얇은 책을 올렸어요. 책을 받치는 힘이 여러 컵에 나뉘면?",
    "choices": [
      "한 컵만 쓸 때보다 무게를 나누어 받쳐요",
      "책의 무게가 없어져요",
      "컵이 저절로 떠요",
      "판이 물로 바뀌어요"
    ],
    "answer": 0,
    "explain": "판은 책의 무게를 여러 컵에 나누어 전달해요. 컵의 모양과 놓인 상태에 따라 버티는 정도가 달라요.",
    "card": "여러 받침은 물체의 무게를 나누어 받쳐요.",
    "experimentId": "science-cup-weight"
  },
  {
    "id": "g3-force-02",
    "audience": "g3",
    "unit": "g3-force",
    "kind": "choice",
    "emoji": "🛝",
    "question": "수레를 움직이려고 밀었어요. 수레에 준 것은?",
    "choices": [
      "달빛",
      "미는 힘",
      "물의 맛",
      "소리의 색"
    ],
    "answer": 1,
    "explain": "물체를 밀거나 당길 때 힘을 줘요. 힘을 주면 물체의 움직임이나 모양이 달라질 수 있어요.",
    "card": "힘은 물체의 움직임이나 모양을 바꿀 수 있어요."
  },
  {
    "id": "g3-force-03",
    "audience": "g3",
    "unit": "g3-force",
    "kind": "choice",
    "emoji": "🛝",
    "question": "섬의 언덕 위로 짐을 옮겨요. 같은 높이까지 완만한 빗면을 쓰면?",
    "choices": [
      "힘을 전혀 쓰지 않아요",
      "이동 거리가 없어져요",
      "더 작은 힘으로 길게 이동해요",
      "짐이 가벼운 공기로 변해요"
    ],
    "answer": 2,
    "explain": "빗면을 쓰면 짐을 곧바로 들어 올릴 때보다 작은 힘으로 옮길 수 있어요. 대신 더 긴 거리를 이동해요.",
    "card": "빗면은 작은 힘으로 짐을 옮기는 데 도움을 줘요."
  },
  {
    "id": "g3-animals-01",
    "audience": "g3",
    "unit": "g3-animals",
    "kind": "choice",
    "emoji": "🐟",
    "question": "개미 길을 볼 때 알맞은 관찰 방법은?",
    "choices": [
      "개미집을 무너뜨려요",
      "개미를 손으로 꾹 눌러요",
      "눈을 감고 수를 정해요",
      "개미를 건드리지 않고 움직임을 살펴요"
    ],
    "answer": 3,
    "explain": "개미는 서로 남긴 냄새 물질 등을 따라 움직일 수 있어요. 생물을 건드리지 않고 관찰하면 자연스러운 모습을 볼 수 있어요.",
    "card": "생물의 생활은 건드리지 않고 관찰해요.",
    "experimentId": "science-ants"
  },
  {
    "id": "g3-animals-02",
    "audience": "g3",
    "unit": "g3-animals",
    "kind": "choice",
    "emoji": "🐟",
    "question": "연못의 물고기가 물속에서 숨을 쉴 때 주로 쓰는 것은?",
    "choices": [
      "아가미",
      "날개",
      "더듬이",
      "털"
    ],
    "answer": 0,
    "explain": "물고기는 주로 아가미로 물속의 산소를 얻어요. 몸의 특징은 사는 환경과 관련이 있어요.",
    "card": "물고기는 주로 아가미로 숨을 쉬어요."
  },
  {
    "id": "g3-animals-03",
    "audience": "g3",
    "unit": "g3-animals",
    "kind": "ox",
    "emoji": "🐟",
    "question": "나비는 다리가 여섯 개인 곤충이에요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "곤충의 몸은 머리, 가슴, 배로 나뉘어요. 가슴에는 다리 세 쌍이 붙어 있어요.",
    "card": "곤충의 다리는 여섯 개예요."
  },
  {
    "id": "g3-plants-01",
    "audience": "g3",
    "unit": "g3-plants",
    "kind": "choice",
    "emoji": "🌵",
    "question": "사막에 사는 선인장의 두꺼운 줄기는 무엇에 도움이 될까요?",
    "choices": [
      "바닷물을 마시는 데",
      "물을 저장하는 데",
      "하늘을 나는 데",
      "소리를 크게 내는 데"
    ],
    "answer": 1,
    "explain": "선인장은 두꺼운 줄기에 물을 저장해요. 건조한 환경에서 살아가는 데 도움이 되는 특징이에요.",
    "card": "선인장은 두꺼운 줄기에 물을 저장해요."
  },
  {
    "id": "g3-plants-02",
    "audience": "g3",
    "unit": "g3-plants",
    "kind": "choice",
    "emoji": "🌵",
    "question": "잎의 생김새로 식물을 나누려 해요. 기준으로 알맞은 것은?",
    "choices": [
      "식물 이름의 글자 수",
      "관찰자의 기분",
      "잎 가장자리의 모양",
      "화분 가격"
    ],
    "answer": 2,
    "explain": "관찰할 수 있는 잎의 특징을 기준으로 나눌 수 있어요. 한 가지 기준을 정하고 같은 방법으로 비교해요.",
    "card": "식물은 잎의 특징으로 분류할 수 있어요."
  },
  {
    "id": "g3-growth-01",
    "audience": "g3",
    "unit": "g3-growth",
    "kind": "choice",
    "emoji": "🦋",
    "question": "나비의 한살이 순서로 알맞은 것은?",
    "choices": [
      "알 → 번데기 → 애벌레 → 어른벌레",
      "어른벌레 → 번데기 → 알 → 애벌레",
      "애벌레 → 알 → 어른벌레 → 번데기",
      "알 → 애벌레 → 번데기 → 어른벌레"
    ],
    "answer": 3,
    "explain": "나비는 알에서 애벌레로 자라요. 번데기를 거쳐 어른벌레가 되는 한살이를 살아요.",
    "card": "나비는 번데기를 거치는 한살이를 살아요."
  },
  {
    "id": "g3-growth-02",
    "audience": "g3",
    "unit": "g3-growth",
    "kind": "choice",
    "emoji": "🦋",
    "question": "대부분의 씨가 싹 트는 데 필요한 조건은?",
    "choices": [
      "물과 알맞은 온도와 공기",
      "소금물과 얼음만",
      "항상 밝은 빛만",
      "흙의 색만"
    ],
    "answer": 0,
    "explain": "대부분의 씨가 싹 트려면 물, 알맞은 온도, 공기가 필요해요. 씨의 종류에 따라 필요한 조건에는 차이가 있어요.",
    "card": "씨가 싹 트려면 물·알맞은 온도·공기가 필요해요."
  },
  {
    "id": "g3-growth-03",
    "audience": "g3",
    "unit": "g3-growth",
    "kind": "ox",
    "emoji": "🦋",
    "question": "모든 동물은 번데기를 거쳐 자라요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "나비는 번데기를 거치지만 잠자리 등은 거치지 않아요. 동물마다 한살이 모습은 달라요.",
    "card": "동물마다 한살이가 달라요."
  },
  {
    "id": "g3-growth-04",
    "audience": "g3",
    "unit": "g3-growth",
    "kind": "choice",
    "emoji": "🦋",
    "question": "연못에서 개구리 알이 부화하면 무엇이 나올까요?",
    "choices": [
      "나비",
      "올챙이",
      "새끼 새",
      "애벌레 나방"
    ],
    "answer": 1,
    "explain": "개구리 알에서 올챙이가 나와요. 올챙이는 자라면서 다리가 생기고 꼬리가 줄어 개구리가 돼요.",
    "card": "개구리는 올챙이를 거쳐 자라요."
  },
  {
    "id": "g3-material-01",
    "audience": "g3",
    "unit": "g3-material",
    "kind": "choice",
    "emoji": "🧊",
    "question": "얼음이 녹아 물이 되었어요. 바뀐 것은?",
    "choices": [
      "물에서 돌로 종류",
      "흰색에서 금속으로 재료",
      "고체에서 액체로 상태",
      "무게가 완전히 없는 것으로 성질"
    ],
    "answer": 2,
    "explain": "얼음과 물은 같은 물질이에요. 얼음이 녹으면 고체에서 액체로 상태가 바뀌어요.",
    "card": "얼음과 물은 상태가 다른 같은 물질이에요.",
    "experimentId": "science-ice"
  },
  {
    "id": "g3-material-02",
    "audience": "g3",
    "unit": "g3-material",
    "kind": "choice",
    "emoji": "🧊",
    "question": "얕은 접시의 물이 조금씩 줄었어요. 물 일부는 무엇이 되었을까요?",
    "choices": [
      "작은 자석",
      "흙",
      "철가루",
      "공기 중의 수증기"
    ],
    "answer": 3,
    "explain": "물은 표면에서 수증기가 되어 공기 중으로 이동할 수 있어요. 이를 증발이라고 해요.",
    "card": "물은 증발하여 수증기가 될 수 있어요.",
    "experimentId": "science-evaporation"
  },
  {
    "id": "g3-material-03",
    "audience": "g3",
    "unit": "g3-material",
    "kind": "choice",
    "emoji": "🧊",
    "question": "차가운 숟가락 겉에 작은 물방울이 생겼어요. 물방울이 된 것은?",
    "choices": [
      "공기 중의 수증기",
      "숟가락 속의 금속",
      "숟가락의 색",
      "빛의 조각"
    ],
    "answer": 0,
    "explain": "공기 중의 수증기가 차가운 숟가락 표면에서 물로 변할 수 있어요. 수증기는 눈에 보이지 않는 기체예요.",
    "card": "수증기가 차가운 표면에서 물방울이 될 수 있어요.",
    "experimentId": "science-spoon-dew"
  },
  {
    "id": "g3-material-04",
    "audience": "g3",
    "unit": "g3-material",
    "kind": "ox",
    "emoji": "🧊",
    "question": "공기는 공간을 차지하지 않아요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "공기도 기체인 물질이라 공간을 차지해요. 거꾸로 세운 컵 안의 공기는 물이 들어오는 것을 막을 수 있어요.",
    "card": "공기도 공간을 차지해요.",
    "experimentId": "science-air-weight"
  },
  {
    "id": "g3-material-05",
    "audience": "g3",
    "unit": "g3-material",
    "kind": "choice",
    "emoji": "🧊",
    "question": "빨간 물감과 노란 물감을 섞으면 보통 어떤 색이 보일까요?",
    "choices": [
      "흰색",
      "주황색",
      "파란색",
      "보라색"
    ],
    "answer": 1,
    "explain": "빨간색과 노란색 물감을 섞으면 보통 주황색으로 보여요. 섞는 양과 물감 종류에 따라 색은 달라질 수 있어요.",
    "card": "물감을 섞으면 다른 색을 만들 수 있어요.",
    "experimentId": "science-paint"
  },
  {
    "id": "g3-material-06",
    "audience": "g3",
    "unit": "g3-material",
    "kind": "ox",
    "emoji": "🧊",
    "question": "설탕이 물에 녹으면 설탕은 완전히 없어진 거예요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "설탕은 눈에 보이지 않을 만큼 작게 나뉘어 물에 섞여 있어요. 물에 녹아도 설탕이 없어진 것은 아니에요.",
    "card": "물에 녹은 설탕도 물속에 남아 있어요.",
    "experimentId": "science-sugar"
  },
  {
    "id": "g3-material-07",
    "audience": "g3",
    "unit": "g3-material",
    "kind": "choice",
    "emoji": "🧊",
    "question": "같은 약한 힘으로 눌렀을 때 더 잘 휘는 것은?",
    "choices": [
      "두꺼운 나무판",
      "큰 돌",
      "얇은 고무판",
      "두꺼운 유리판"
    ],
    "answer": 2,
    "explain": "고무는 작은 힘에도 모양이 잘 바뀌는 성질이 있어요. 물체의 재료와 두께에 따라 휘는 정도는 달라요.",
    "card": "물질의 성질을 물체의 쓰임새에 이용해요.",
    "experimentId": "science-bend"
  },
  {
    "id": "g3-material-08",
    "audience": "g3",
    "unit": "g3-material",
    "kind": "choice",
    "emoji": "🧊",
    "question": "휴지 끝을 물에 담갔어요. 물은 휴지에서 어떻게 움직일까요?",
    "choices": [
      "항상 아래로만 내려가요",
      "즉시 철로 바뀌어요",
      "색만 남기고 사라져요",
      "작은 틈을 따라 올라가요"
    ],
    "answer": 3,
    "explain": "휴지에는 아주 작은 틈들이 있어요. 물이 그 틈을 따라 스며들며 위로 올라갈 수 있어요.",
    "card": "물은 휴지의 작은 틈을 따라 스며들어요.",
    "experimentId": "science-tissue"
  },
  {
    "id": "g3-earth-01",
    "audience": "g3",
    "unit": "g3-earth",
    "kind": "choice",
    "emoji": "🏝️",
    "question": "섬 주변 바닷물과 강물을 비교해요. 보통 더 짠 것은?",
    "choices": [
      "바닷물",
      "강물",
      "둘 다 소금이 전혀 없어요",
      "항상 강물이 더 짜요"
    ],
    "answer": 0,
    "explain": "바닷물에는 여러 가지 물질이 녹아 있고 소금 성분이 많아요. 강물보다 보통 더 짜요.",
    "card": "바닷물에는 소금 성분이 녹아 있어요."
  },
  {
    "id": "g3-earth-02",
    "audience": "g3",
    "unit": "g3-earth",
    "kind": "ox",
    "emoji": "🏝️",
    "question": "지구 표면에서 바다가 차지하는 넓이는 육지보다 커요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "지구 표면의 약 열 부분 중 일곱 부분은 바다예요. 바다가 육지보다 넓게 차지해요.",
    "card": "지구 표면에는 육지보다 바다가 더 넓어요."
  },
  {
    "id": "g3-earth-03",
    "audience": "g3",
    "unit": "g3-earth",
    "kind": "choice",
    "emoji": "🏝️",
    "question": "지구를 둘러싸고 있는 기체는 무엇일까요?",
    "choices": [
      "유리",
      "공기",
      "얼음",
      "흙"
    ],
    "answer": 1,
    "explain": "지구는 공기로 둘러싸여 있어요. 공기는 우리가 숨을 쉬는 데도 필요해요.",
    "card": "지구는 공기로 둘러싸여 있어요."
  },
  {
    "id": "g3-earth-04",
    "audience": "g3",
    "unit": "g3-earth",
    "kind": "choice",
    "emoji": "🏝️",
    "question": "바닷물이 해안 쪽으로 들어와 높아지는 때는?",
    "choices": [
      "썰물",
      "가뭄",
      "밀물",
      "지진"
    ],
    "answer": 2,
    "explain": "밀물 때에는 바닷물이 들어와 수면이 높아져요. 썰물 때에는 바닷물이 빠져나가 수면이 낮아져요.",
    "card": "밀물과 썰물은 바닷물이 드나드는 현상이에요."
  },
  {
    "id": "g3-earth-05",
    "audience": "g3",
    "unit": "g3-earth",
    "kind": "choice",
    "emoji": "🏝️",
    "question": "갯벌을 보호해야 하는 까닭은?",
    "choices": [
      "살아 있는 생물이 전혀 없어서",
      "바닷물이 절대 오지 않아서",
      "모두 콘크리트라서",
      "여러 생물의 삶터라서"
    ],
    "answer": 3,
    "explain": "갯벌에는 게, 조개 등 여러 생물이 살아요. 생물의 삶터를 지키기 위해 갯벌을 보호해야 해요.",
    "card": "갯벌은 여러 생물의 삶터예요."
  },
  {
    "id": "g3-earth-06",
    "audience": "g3",
    "unit": "g3-earth",
    "kind": "ox",
    "emoji": "🏝️",
    "question": "바닷가에서는 보호자 없이 밀물이 와도 계속 놀아도 돼요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "밀물이 들면 길이 물에 잠길 수 있어요. 보호자와 함께 물때와 안전 안내를 확인해야 해요.",
    "card": "바닷가에서는 물때와 안전 안내를 확인해요."
  },
  {
    "id": "g3-earth-07",
    "audience": "g3",
    "unit": "g3-earth",
    "kind": "choice",
    "emoji": "🏝️",
    "question": "육지에서 볼 수 있는 물은 무엇일까요?",
    "choices": [
      "강물과 호수의 물",
      "태양의 빛",
      "바위의 색",
      "달의 그림자"
    ],
    "answer": 0,
    "explain": "육지에서는 강, 호수 등에 물이 있어요. 이 물은 생물과 사람의 생활에 쓰여요.",
    "card": "육지에도 강과 호수 등 여러 곳에 물이 있어요."
  },
  {
    "id": "g3-sound-01",
    "audience": "g3",
    "unit": "g3-sound",
    "kind": "choice",
    "emoji": "🎵",
    "question": "소리가 나는 북의 가죽을 만지면 어떤 특징을 느낄까요?",
    "choices": [
      "녹는 느낌",
      "떨림",
      "자석의 힘",
      "물이 생김"
    ],
    "answer": 1,
    "explain": "북을 치면 가죽이 떨리면서 소리가 나요. 소리가 나는 물체는 떨려요.",
    "card": "소리가 나는 물체는 떨려요."
  },
  {
    "id": "g3-sound-02",
    "audience": "g3",
    "unit": "g3-sound",
    "kind": "choice",
    "emoji": "🎵",
    "question": "같은 북을 더 세게 두드리면 보통 어떻게 들릴까요?",
    "choices": [
      "항상 더 높은 소리",
      "소리가 전혀 안 남",
      "더 큰 소리",
      "항상 같은 크기"
    ],
    "answer": 2,
    "explain": "더 세게 두드리면 북의 떨림이 커져요. 떨림이 커지면 보통 더 큰 소리가 나요.",
    "card": "떨림의 크기가 소리의 크기에 영향을 줘요."
  },
  {
    "id": "g3-sound-03",
    "audience": "g3",
    "unit": "g3-sound",
    "kind": "ox",
    "emoji": "🎵",
    "question": "높은 소리와 큰 소리는 같은 뜻이에요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "높고 낮음은 소리의 높낮이예요. 크고 작음은 소리의 크기로 서로 다른 특징이에요.",
    "card": "소리의 크기와 높낮이는 달라요."
  },
  {
    "id": "g3-sound-04",
    "audience": "g3",
    "unit": "g3-sound",
    "kind": "choice",
    "emoji": "🎵",
    "question": "소리를 전달할 수 있는 것은?",
    "choices": [
      "빛만",
      "색만",
      "빈 우주 공간만",
      "공기와 물과 고체"
    ],
    "answer": 3,
    "explain": "소리는 공기뿐 아니라 물과 고체를 통해서도 전달돼요. 소리를 전달하는 물질이 필요해요.",
    "card": "공기·물·고체가 소리를 전달해요."
  },
  {
    "id": "g3-sound-05",
    "audience": "g3",
    "unit": "g3-sound",
    "kind": "ox",
    "emoji": "🎵",
    "question": "줄을 짧게 잡고 튕기면 보통 더 높은 소리가 나요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "같은 줄에서 떨리는 부분이 짧아지면 더 빠르게 떨려요. 빠른 떨림은 더 높은 소리를 만들어요.",
    "card": "빠르게 떨릴수록 소리가 높아요."
  },
  {
    "id": "g3-sound-06",
    "audience": "g3",
    "unit": "g3-sound",
    "kind": "choice",
    "emoji": "🎵",
    "question": "귀를 보호하는 습관은 무엇일까요?",
    "choices": [
      "이어폰 소리를 작게 해요",
      "큰 소리를 오래 들어요",
      "귀 가까이에서 고함쳐요",
      "시끄러운 곳에 계속 있어요"
    ],
    "answer": 0,
    "explain": "큰 소리를 오래 들으면 귀에 해로울 수 있어요. 적당한 크기로 듣고 쉬는 시간을 가져요.",
    "card": "큰 소리를 오래 듣지 않아 귀를 보호해요."
  },
  {
    "id": "g3-sound-07",
    "audience": "g3",
    "unit": "g3-sound",
    "kind": "choice",
    "emoji": "🎵",
    "question": "교실의 소음을 줄이는 방법은?",
    "choices": [
      "의자를 더 세게 끌어요",
      "의자 다리에 부드러운 덮개를 씌워요",
      "바닥을 계속 두드려요",
      "모두 크게 외쳐요"
    ],
    "answer": 1,
    "explain": "부드러운 덮개는 의자와 바닥이 부딪치며 나는 소리를 줄여요. 작은 배려로 함께 쓰는 공간의 소음을 줄일 수 있어요.",
    "card": "부드러운 재료는 생활 속 소음을 줄이는 데 쓰여요."
  },
  {
    "id": "g3-health-01",
    "audience": "g3",
    "unit": "g3-health",
    "kind": "choice",
    "emoji": "🧼",
    "question": "감염병을 예방하는 손 씻기 습관은?",
    "choices": [
      "물 없이 손만 흔들어요",
      "손이 더러워도 그대로 먹어요",
      "비누로 손바닥과 손가락 사이까지 씻어요",
      "수건만 바라봐요"
    ],
    "answer": 2,
    "explain": "손을 꼼꼼히 씻으면 손에 묻은 병원체를 줄일 수 있어요. 식사 전이나 화장실을 다녀온 뒤에 손을 씻어요.",
    "card": "꼼꼼한 손 씻기는 감염병 예방에 도움이 돼요."
  },
  {
    "id": "g3-health-02",
    "audience": "g3",
    "unit": "g3-health",
    "kind": "ox",
    "emoji": "🧼",
    "question": "기침할 때 옷소매로 입과 코를 가려요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "기침이나 재채기를 할 때 침방울이 퍼질 수 있어요. 옷소매로 가리면 주위에 퍼지는 것을 줄일 수 있어요.",
    "card": "기침할 때 옷소매로 입과 코를 가려요."
  },
  {
    "id": "g3-health-03",
    "audience": "g3",
    "unit": "g3-health",
    "kind": "choice",
    "emoji": "🧼",
    "question": "감염병에 걸린 것 같을 때 어떻게 할까요?",
    "choices": [
      "아픈 것을 숨겨요",
      "아무 약이나 혼자 먹어요",
      "친구에게 기침해요",
      "보호자에게 몸 상태를 알려요"
    ],
    "answer": 3,
    "explain": "몸이 아프면 보호자에게 증상을 알려요. 보호자의 도움으로 알맞은 진료와 휴식을 받아요.",
    "card": "아프면 보호자에게 몸 상태를 알려요."
  },
  {
    "id": "g3-health-04",
    "audience": "g3",
    "unit": "g3-health",
    "kind": "ox",
    "emoji": "🧼",
    "question": "환기는 감염병 예방에 도움이 될 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "환기를 하면 실내 공기가 바깥 공기로 바뀌어요. 공기 중 병원체가 쌓이는 것을 줄이는 데 도움이 돼요.",
    "card": "환기는 실내 공기를 바꾸어 줘요."
  },
  {
    "id": "g3-health-05",
    "audience": "g3",
    "unit": "g3-health",
    "kind": "choice",
    "emoji": "🧼",
    "question": "친구와 함께 지내며 지킬 습관은?",
    "choices": [
      "개인 물병은 따로 써요",
      "물병을 항상 함께 써요",
      "아픈 친구를 놀려요",
      "손 씻기를 막아요"
    ],
    "answer": 0,
    "explain": "개인 물건을 따로 쓰면 병원체가 옮는 기회를 줄일 수 있어요. 아픈 친구를 배려하는 태도도 필요해요.",
    "card": "개인 물건을 따로 쓰고 아픈 친구를 배려해요."
  },
  {
    "id": "g3-health-06",
    "audience": "g3",
    "unit": "g3-health",
    "kind": "ox",
    "emoji": "🧼",
    "question": "백신을 맞으면 모든 감염병을 완전히 막을 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "백신은 특정 감염병을 예방하거나 심하게 앓을 위험을 줄여요. 모든 감염병을 막는 것은 아니므로 다른 예방 수칙도 지켜요.",
    "card": "예방 접종과 생활 속 예방 수칙을 함께 지켜요."
  },
  {
    "id": "g5-rocks-01",
    "audience": "g5",
    "unit": "g5-rocks",
    "kind": "choice",
    "emoji": "🦴",
    "question": "지층의 줄무늬가 생기는 주된 까닭은?",
    "choices": [
      "퇴적물이 층층이 쌓여서",
      "태양이 돌에 줄을 그어서",
      "모든 바위가 한 번에 얼어서",
      "달빛이 바위를 잘라서"
    ],
    "answer": 0,
    "explain": "물 등이 운반한 퇴적물이 쌓여 층을 이루어요. 시간에 따라 퇴적물의 종류나 크기가 달라져 줄무늬가 보일 수 있어요.",
    "card": "지층은 퇴적물이 층층이 쌓여 만들어져요.",
    "why": "퇴적 환경이 바뀌면 쌓이는 물질도 달라질 수 있어요."
  },
  {
    "id": "g5-rocks-02",
    "audience": "g5",
    "unit": "g5-rocks",
    "kind": "choice",
    "emoji": "🦴",
    "question": "화석으로 알 수 있는 것은?",
    "choices": [
      "내일의 정확한 날씨",
      "옛 생물과 당시 환경",
      "모든 별의 나이",
      "지금의 모든 동물 수"
    ],
    "answer": 1,
    "explain": "화석은 옛 생물의 몸이나 흔적이 남은 것이에요. 생물의 특징을 통해 당시 환경도 짐작할 수 있어요.",
    "card": "화석은 옛 생물과 환경을 알려 줘요.",
    "why": "바다 생물 화석은 그 지층이 바다 환경에서 쌓였을 가능성을 보여 줘요."
  },
  {
    "id": "g5-light-01",
    "audience": "g5",
    "unit": "g5-light",
    "kind": "choice",
    "emoji": "🔦",
    "question": "그림자 시계에서 시간이 지나면 그림자 방향이 달라지는 까닭은?",
    "choices": [
      "막대의 재료가 매번 변해서",
      "그림자가 스스로 돌아서",
      "하늘에서 보이는 태양의 위치가 달라져서",
      "지구의 공기가 사라져서"
    ],
    "answer": 2,
    "explain": "하루 동안 하늘에서 보이는 태양의 위치가 달라져요. 빛이 막대에 비치는 방향도 바뀌어 그림자 방향이 달라져요.",
    "card": "태양이 보이는 위치에 따라 그림자가 달라져요.",
    "experimentId": "science-sun-clock",
    "why": "태양이 하루 동안 움직이는 것처럼 보이는 현상은 지구의 자전과 관련 있어요."
  },
  {
    "id": "g5-light-02",
    "audience": "g5",
    "unit": "g5-light",
    "kind": "ox",
    "emoji": "🔦",
    "question": "달은 태양처럼 스스로 빛을 만들어 밝게 보여요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "달은 태양처럼 스스로 많은 빛을 내는 별이 아니에요. 태양빛을 반사한 부분이 우리 눈에 밝게 보여요.",
    "card": "달은 태양빛을 반사해 밝게 보여요.",
    "experimentId": "science-moon",
    "why": "달 모양 변화는 태양빛을 받는 부분 중 지구에서 보이는 부분이 달라져 생겨요."
  },
  {
    "id": "g5-light-03",
    "audience": "g5",
    "unit": "g5-light",
    "kind": "choice",
    "emoji": "🔦",
    "question": "장애물 뒤를 보는 장치에 거울 두 개를 넣었어요. 이용한 빛의 성질은?",
    "choices": [
      "용해",
      "증발",
      "응고",
      "반사"
    ],
    "answer": 3,
    "explain": "빛은 거울에 닿아 진행 방향을 바꿀 수 있어요. 잠망경은 이런 반사를 이용해 가려진 곳 너머를 보아요.",
    "card": "거울은 빛을 반사해요.",
    "why": "거울의 기울기를 조절하면 빛이 반사되어 가는 방향도 달라져요."
  },
  {
    "id": "g5-solution-01",
    "audience": "g5",
    "unit": "g5-solution",
    "kind": "choice",
    "emoji": "🧂",
    "question": "같은 각설탕을 비교할 때 보통 더 빨리 녹는 물은?",
    "choices": [
      "미지근한 물",
      "차가운 물",
      "물이 없는 컵",
      "두 물의 온도는 영향이 없어요"
    ],
    "answer": 0,
    "explain": "같은 조건에서 설탕은 보통 온도가 높은 물에 더 빨리 녹아요. 비교할 때 물의 양과 젓는 방법도 같게 해야 해요.",
    "card": "물의 온도는 설탕이 녹는 빠르기에 영향을 줘요.",
    "experimentId": "science-sugar-temp",
    "why": "녹는 빠르기와 최대로 녹을 수 있는 양은 서로 다른 특징이에요."
  },
  {
    "id": "g5-solution-02",
    "audience": "g5",
    "unit": "g5-solution",
    "kind": "ox",
    "emoji": "🧂",
    "question": "같은 온도의 물에 소금을 계속 넣으면 어느 때부터 남을 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "정해진 양의 물에 녹을 수 있는 소금의 양에는 한계가 있어요. 그보다 많이 넣으면 일부가 녹지 않고 남아요.",
    "card": "정해진 물에 녹을 수 있는 용질의 양에는 한계가 있어요.",
    "experimentId": "science-salt-limit",
    "why": "온도와 물의 양을 정해야 최대로 녹는 양을 비교할 수 있어요."
  },
  {
    "id": "g5-body-01",
    "audience": "g5",
    "unit": "g5-body",
    "kind": "choice",
    "emoji": "🫁",
    "question": "팔을 굽힐 때 뼈를 움직이는 데 직접 관여하는 것은?",
    "choices": [
      "머리카락",
      "근육",
      "땀",
      "소화액"
    ],
    "answer": 1,
    "explain": "근육은 뼈에 연결되어 있어요. 근육이 수축하고 이완하며 뼈를 움직여요.",
    "card": "뼈와 근육이 함께 몸을 움직여요.",
    "why": "근육은 주로 당기는 힘으로 작용하므로 서로 다른 근육이 짝을 이루어 움직여요."
  },
  {
    "id": "g5-body-02",
    "audience": "g5",
    "unit": "g5-body",
    "kind": "choice",
    "emoji": "🫁",
    "question": "호흡기관이 하는 중요한 일은?",
    "choices": [
      "피부색만 바꿔요",
      "음식을 잘게 씹어요",
      "산소를 받아들이고 이산화 탄소를 내보내요",
      "뼈의 길이를 재요"
    ],
    "answer": 2,
    "explain": "폐에서는 공기와 혈액 사이에 기체 교환이 일어나요. 들이마신 공기에서 산소를 얻고 이산화 탄소를 내보내요.",
    "card": "호흡으로 산소를 얻고 이산화 탄소를 내보내요.",
    "why": "순환기관은 폐에서 받은 산소를 온몸으로 운반해요."
  },
  {
    "id": "g5-body-03",
    "audience": "g5",
    "unit": "g5-body",
    "kind": "ox",
    "emoji": "🫁",
    "question": "심장은 혈액을 온몸으로 보내는 펌프 역할을 해요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "심장이 뛰면서 혈액을 혈관으로 보내요. 혈액은 산소와 영양소 등을 운반해요.",
    "card": "심장은 혈액을 온몸으로 보내요.",
    "why": "혈액 순환은 호흡·소화 등 다른 기관의 작용과 연결되어 있어요."
  },
  {
    "id": "g5-body-04",
    "audience": "g5",
    "unit": "g5-body",
    "kind": "choice",
    "emoji": "🫁",
    "question": "소장에서 주로 일어나는 일은?",
    "choices": [
      "공기의 출입",
      "소리의 전달",
      "뼈의 움직임",
      "소화된 영양소의 흡수"
    ],
    "answer": 3,
    "explain": "음식은 여러 소화기관을 거치며 잘게 분해돼요. 소장에서는 소화된 영양소가 주로 흡수돼요.",
    "card": "소장에서 소화된 영양소가 주로 흡수돼요.",
    "why": "흡수된 영양소는 혈액 등을 통해 몸의 여러 부분으로 이동해요."
  },
  {
    "id": "g5-body-05",
    "audience": "g5",
    "unit": "g5-body",
    "kind": "choice",
    "emoji": "🫁",
    "question": "신장이 하는 일은?",
    "choices": [
      "혈액 속 노폐물 등을 걸러 오줌을 만들어요",
      "음식을 씹어요",
      "빛을 반사해요",
      "공기를 들이마셔요"
    ],
    "answer": 0,
    "explain": "신장은 혈액에서 노폐물과 남는 물 등을 걸러요. 이렇게 만들어진 오줌이 몸 밖으로 배출돼요.",
    "card": "신장은 혈액을 걸러 오줌을 만들어요.",
    "why": "신장은 몸속 물과 염류의 양을 조절하는 데도 관여해요."
  },
  {
    "id": "g5-mixture-01",
    "audience": "g5",
    "unit": "g5-mixture",
    "kind": "choice",
    "emoji": "🧺",
    "question": "모래와 자갈을 분리할 도구로 알맞은 것은?",
    "choices": [
      "온도계",
      "알맞은 구멍 크기의 체",
      "거울",
      "나침반"
    ],
    "answer": 1,
    "explain": "모래와 자갈은 알갱이의 크기가 달라요. 작은 알갱이만 통과하는 체를 사용하면 분리할 수 있어요.",
    "card": "알갱이 크기가 다르면 체로 분리할 수 있어요.",
    "why": "체 구멍은 모래보다 크고 자갈보다 작게 고르는 것이 좋아요."
  },
  {
    "id": "g5-mixture-02",
    "audience": "g5",
    "unit": "g5-mixture",
    "kind": "choice",
    "emoji": "🧺",
    "question": "철 클립과 나무 조각이 섞였어요. 분리에 쓸 성질은?",
    "choices": [
      "둘 다 투명한 성질",
      "모두 물에 녹는 성질",
      "철이 자석에 붙는 성질",
      "색이 항상 같은 성질"
    ],
    "answer": 2,
    "explain": "철 클립은 자석에 붙지만 나무 조각은 붙지 않아요. 두 물질의 다른 성질을 이용해 분리해요.",
    "card": "혼합물은 재료의 서로 다른 성질을 이용해 분리해요.",
    "why": "분리하려는 물질마다 어떤 성질이 다른지 먼저 확인해요."
  },
  {
    "id": "g5-mixture-03",
    "audience": "g5",
    "unit": "g5-mixture",
    "kind": "ox",
    "emoji": "🧺",
    "question": "물과 식용유는 기다리면 층이 나뉘므로 층을 이용해 분리할 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "식용유와 물은 잘 섞이지 않아 층을 이루어요. 서로 다른 층을 나누어 받으면 분리할 수 있어요.",
    "card": "섞이지 않는 액체는 층을 이용해 분리해요.",
    "why": "액체가 항상 층을 이루는 것은 아니므로 잘 섞이는 액체에는 이 방법을 쓸 수 없어요."
  },
  {
    "id": "g5-mixture-04",
    "audience": "g5",
    "unit": "g5-mixture",
    "kind": "choice",
    "emoji": "🧺",
    "question": "소금과 모래를 물에 넣고 걸렀어요. 거름종이에 주로 남는 것은?",
    "choices": [
      "녹은 소금만",
      "깨끗한 공기",
      "녹은 물만",
      "모래"
    ],
    "answer": 3,
    "explain": "소금은 물에 녹지만 모래는 거의 녹지 않아요. 물에 녹지 않은 모래가 거름종이에 남아요.",
    "card": "용해되는 성질과 거름을 이용해 혼합물을 분리해요.",
    "why": "녹은 소금은 물과 함께 거름종이를 통과해요."
  },
  {
    "id": "g5-mixture-05",
    "audience": "g5",
    "unit": "g5-mixture",
    "kind": "choice",
    "emoji": "🧺",
    "question": "혼합물의 예로 알맞은 것은?",
    "choices": [
      "소금과 모래를 섞은 것",
      "소금 한 종류만 있는 것",
      "순수한 물만 있는 것",
      "산소 한 종류만 있는 것"
    ],
    "answer": 0,
    "explain": "혼합물은 두 가지 이상의 물질이 섞인 것이에요. 각각의 성질을 이용하면 분리할 수 있어요.",
    "card": "혼합물은 두 가지 이상의 물질이 섞인 것이에요.",
    "why": "섞였다고 해서 언제나 새로운 물질이 만들어지는 것은 아니에요."
  },
  {
    "id": "g5-mixture-06",
    "audience": "g5",
    "unit": "g5-mixture",
    "kind": "ox",
    "emoji": "🧺",
    "question": "정수 장치의 거름망으로 모든 녹은 물질과 병원체를 없앨 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "거름망은 구멍보다 큰 물질을 걸러요. 녹은 물질이나 작은 병원체가 남을 수 있으므로 거른 물을 함부로 마시면 안 돼요.",
    "card": "거름망만으로 물의 안전을 보장할 수는 없어요.",
    "why": "먹는 물을 만드는 과정에는 여러 처리 단계와 안전 검사가 필요해요."
  },
  {
    "id": "g5-heat-01",
    "audience": "g5",
    "unit": "g5-heat",
    "kind": "choice",
    "emoji": "🌡️",
    "question": "따뜻한 물의 열이 손잡이에 더 잘 전해지는 숟가락은?",
    "choices": [
      "같은 모양의 나무 숟가락",
      "금속 숟가락",
      "같은 모양의 플라스틱 숟가락",
      "재료와 관계없이 모두 같아요"
    ],
    "answer": 1,
    "explain": "금속은 나무나 플라스틱보다 보통 열을 잘 전달해요. 고체 내부에서 열이 전달되는 방식을 전도라고 해요.",
    "card": "금속은 보통 열을 잘 전달해요.",
    "experimentId": "science-heat-spoon",
    "why": "재료마다 열을 전달하는 정도가 달라 손잡이와 용기의 재료를 다르게 고를 수 있어요."
  },
  {
    "id": "g5-heat-02",
    "audience": "g5",
    "unit": "g5-heat",
    "kind": "choice",
    "emoji": "🌡️",
    "question": "온도가 다른 두 물체가 닿으면 열은 주로 어디로 이동할까요?",
    "choices": [
      "항상 작은 물체에서 큰 물체로",
      "항상 아래에서 위로만",
      "온도가 높은 쪽에서 낮은 쪽으로",
      "온도와 상관없이 한 방향으로"
    ],
    "answer": 2,
    "explain": "열은 온도가 높은 물체에서 낮은 물체로 이동해요. 시간이 지나면 두 물체의 온도 차이가 줄어들어요.",
    "card": "열은 높은 온도에서 낮은 온도로 이동해요.",
    "why": "열의 이동은 두 물체의 온도가 같아지는 방향으로 일어나요."
  },
  {
    "id": "g5-heat-03",
    "audience": "g5",
    "unit": "g5-heat",
    "kind": "choice",
    "emoji": "🌡️",
    "question": "장애물 모형의 금속 손잡이를 감쌀 재료를 골라요. 열 전달을 줄일 재료는?",
    "choices": [
      "얇은 알루미늄판",
      "철판",
      "구리판",
      "두꺼운 천"
    ],
    "answer": 3,
    "explain": "천은 금속보다 열을 잘 전달하지 않아요. 열이 이동하는 것을 줄이는 일을 단열이라고 해요.",
    "card": "열을 잘 전달하지 않는 재료를 단열에 이용해요.",
    "why": "천 사이의 공기층도 열 전달을 줄이는 데 도움이 돼요."
  },
  {
    "id": "g5-heat-04",
    "audience": "g5",
    "unit": "g5-heat",
    "kind": "choice",
    "emoji": "🌡️",
    "question": "온도계로 온도를 잴 때 알맞은 방법은?",
    "choices": [
      "측정 부분을 대상에 대고 값이 안정될 때 읽어요",
      "색만 보고 값을 정해요",
      "측정 부분을 손으로 꼭 잡아요",
      "눈금을 가리고 읽어요"
    ],
    "answer": 0,
    "explain": "온도계의 측정 부분이 대상과 알맞게 닿아야 해요. 수치가 안정된 뒤 눈금을 바르게 읽어요.",
    "card": "온도계로 물체의 뜨겁고 차가운 정도를 재요.",
    "why": "온도계 종류에 따라 사용법과 측정 범위가 다르므로 안내를 확인해요."
  },
  {
    "id": "g5-heat-05",
    "audience": "g5",
    "unit": "g5-heat",
    "kind": "ox",
    "emoji": "🌡️",
    "question": "실내 난방으로 따뜻해진 공기는 주위의 찬 공기보다 위로 올라가기 쉬워요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "따뜻해진 공기는 보통 팽창하여 밀도가 작아져요. 주변의 찬 공기와 위치가 바뀌며 열을 전달해요.",
    "card": "공기의 움직임으로도 열이 전달돼요.",
    "why": "액체와 기체의 움직임으로 열이 이동하는 방식을 대류라고 해요."
  },
  {
    "id": "g5-heat-06",
    "audience": "g5",
    "unit": "g5-heat",
    "kind": "choice",
    "emoji": "🌡️",
    "question": "햇빛을 받아 물체가 따뜻해질 때 열을 전달하는 것은?",
    "choices": [
      "금속선만",
      "빛",
      "소금 알갱이",
      "거름종이"
    ],
    "answer": 1,
    "explain": "빛을 받은 물체는 에너지를 흡수해 따뜻해질 수 있어요. 햇빛의 열은 빈 공간도 지나 지구에 도달해요.",
    "card": "빛에 의해서도 열이 전달돼요.",
    "why": "빛에 의한 열 전달은 물질의 직접 접촉이나 흐름이 필요하지 않아요."
  },
  {
    "id": "g5-weather-01",
    "audience": "g5",
    "unit": "g5-weather",
    "kind": "choice",
    "emoji": "☁️",
    "question": "차가운 물병 바깥에 맺힌 물방울은 주로 어디에서 왔을까요?",
    "choices": [
      "새지 않는 병 안의 물",
      "병의 플라스틱",
      "공기 중 수증기",
      "햇빛 속 물"
    ],
    "answer": 2,
    "explain": "공기 중 수증기가 차가운 병 표면에서 응결해 물방울이 돼요. 구름과 안개도 수증기가 작은 물방울 등으로 변해 만들어져요.",
    "card": "수증기가 차가워지면 물방울로 응결할 수 있어요.",
    "experimentId": "science-cloud",
    "why": "병 표면이 이슬점 이하로 차가워지면 응결이 일어날 수 있어요."
  },
  {
    "id": "g5-weather-02",
    "audience": "g5",
    "unit": "g5-weather",
    "kind": "choice",
    "emoji": "☁️",
    "question": "구름과 안개에 대한 설명으로 알맞은 것은?",
    "choices": [
      "구름은 항상 고체 바위예요",
      "안개에는 물방울이 없어요",
      "둘 다 눈에 보이지 않는 수증기만이에요",
      "생기는 높이가 달라요"
    ],
    "answer": 3,
    "explain": "안개는 지표 가까이, 구름은 주로 하늘 높이 생겨요. 둘 다 작은 물방울이나 얼음 알갱이 등이 모인 것이에요.",
    "card": "안개와 구름은 주로 생기는 높이가 달라요.",
    "why": "눈에 보이는 흰 구름과 눈에 보이지 않는 수증기를 구분해요."
  },
  {
    "id": "g5-weather-03",
    "audience": "g5",
    "unit": "g5-weather",
    "kind": "ox",
    "emoji": "☁️",
    "question": "바람은 공기가 움직이지 않을 때 생겨요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "공기는 기압 차이 때문에 이동할 수 있어요. 이 공기의 움직임을 바람이라고 해요.",
    "card": "바람은 공기의 움직임이에요.",
    "why": "지표 부근의 바람은 대체로 고기압에서 저기압 쪽으로 불어요."
  },
  {
    "id": "g5-weather-04",
    "audience": "g5",
    "unit": "g5-weather",
    "kind": "choice",
    "emoji": "☁️",
    "question": "기상 자료에서 기온을 나타낼 때 쓰는 단위는?",
    "choices": [
      "섭씨도",
      "센티미터",
      "킬로그램",
      "리터"
    ],
    "answer": 0,
    "explain": "기온은 공기의 온도예요. 우리나라에서는 보통 섭씨도로 나타내요.",
    "card": "기온은 공기의 온도예요.",
    "why": "바람의 속력, 강수량 등은 기온과 다른 기상 요소예요."
  },
  {
    "id": "g5-weather-05",
    "audience": "g5",
    "unit": "g5-weather",
    "kind": "choice",
    "emoji": "☁️",
    "question": "비가 오는 날 야외 만들기 활동을 계획했어요. 먼저 확인할 것은?",
    "choices": [
      "친구의 신발 색만",
      "기상 예보와 안전 안내",
      "책상 높이만",
      "지난달 달 모양만"
    ],
    "answer": 1,
    "explain": "날씨는 야외 활동의 안전에 영향을 줘요. 기상 예보를 확인하고 위험한 날에는 실내 활동으로 바꾸어요.",
    "card": "날씨에 맞추어 안전한 활동을 계획해요.",
    "why": "강풍이나 호우 특보가 있으면 보호자의 안내에 따라 활동을 조정해요."
  },
  {
    "id": "g5-weather-06",
    "audience": "g5",
    "unit": "g5-weather",
    "kind": "choice",
    "emoji": "☁️",
    "question": "공기 중 수증기의 양과 관련된 기상 요소는?",
    "choices": [
      "태양의 색",
      "모래의 크기",
      "습도",
      "책의 무게"
    ],
    "answer": 2,
    "explain": "습도는 공기가 얼마나 습한지를 나타내요. 공기 중 수증기가 많고 적음과 관련 있어요.",
    "card": "습도는 공기의 습한 정도를 나타내요.",
    "why": "같은 수증기 양이어도 기온이 달라지면 상대 습도는 달라질 수 있어요."
  },
  {
    "id": "g5-energy-01",
    "audience": "g5",
    "unit": "g5-energy",
    "kind": "choice",
    "emoji": "☀️",
    "question": "태양광 발전이 이용하는 것은?",
    "choices": [
      "석탄만",
      "석유만",
      "물의 맛",
      "태양빛"
    ],
    "answer": 3,
    "explain": "태양광 발전은 태양빛의 에너지를 전기 에너지로 바꾸어요. 태양빛은 재생에너지의 한 종류예요.",
    "card": "태양광 발전은 태양빛으로 전기를 만들어요.",
    "why": "발전량은 햇빛의 양과 날씨 등에 따라 달라져요."
  },
  {
    "id": "g5-energy-02",
    "audience": "g5",
    "unit": "g5-energy",
    "kind": "choice",
    "emoji": "☀️",
    "question": "풍력 발전이 이용하는 것은?",
    "choices": [
      "바람의 움직임",
      "땅의 색",
      "바닷물의 짠맛",
      "종이의 냄새"
    ],
    "answer": 0,
    "explain": "바람이 날개를 돌리고 발전 장치에서 전기를 만들어요. 바람의 에너지도 재생에너지예요.",
    "card": "풍력 발전은 바람의 움직임을 이용해요.",
    "why": "안정적인 전력 공급을 위해 발전 방식과 저장 장치를 함께 고려해요."
  },
  {
    "id": "g5-energy-03",
    "audience": "g5",
    "unit": "g5-energy",
    "kind": "ox",
    "emoji": "☀️",
    "question": "석유와 석탄은 짧은 시간에 계속 새로 만들어져요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "석유와 석탄은 만들어지는 데 매우 오랜 시간이 걸려요. 사람들이 쓰는 속도만큼 빨리 다시 생기지 않아 아껴 써야 해요.",
    "card": "석유와 석탄은 한정된 자원이에요.",
    "why": "이런 자원은 사람의 생활 시간 규모에서 다시 채워지기 어려워요."
  },
  {
    "id": "g5-energy-04",
    "audience": "g5",
    "unit": "g5-energy",
    "kind": "choice",
    "emoji": "☀️",
    "question": "만들기 활동에서 자원을 아끼는 방법은?",
    "choices": [
      "쓸 수 있는 재료도 모두 버려요",
      "남은 재료를 다음 작품에 다시 써요",
      "필요량보다 훨씬 많이 꺼내요",
      "작품을 만들 때마다 새 재료만 써요"
    ],
    "answer": 1,
    "explain": "쓸 수 있는 재료를 다시 쓰면 새 자원을 덜 사용해요. 필요한 양만 준비하는 것도 자원을 아끼는 방법이에요.",
    "card": "재사용은 자원을 아끼는 데 도움이 돼요.",
    "why": "재사용과 재활용은 새 자원을 얻는 과정에서 드는 에너지도 줄일 수 있어요."
  },
  {
    "id": "g5-energy-05",
    "audience": "g5",
    "unit": "g5-energy",
    "kind": "ox",
    "emoji": "☀️",
    "question": "쓰지 않는 방의 조명을 끄면 전기 에너지를 아낄 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "조명을 켜 두면 전기 에너지가 계속 사용돼요. 필요 없는 조명을 끄면 에너지 낭비를 줄일 수 있어요.",
    "card": "쓰지 않는 조명을 꺼 에너지를 아껴요.",
    "why": "같은 밝기에서 소비 전력이 작은 조명을 사용하는 방법도 있어요."
  },
  {
    "id": "g5-energy-06",
    "audience": "g5",
    "unit": "g5-energy",
    "kind": "ox",
    "emoji": "☀️",
    "question": "재생에너지를 이용하면 어떤 환경 영향도 전혀 없어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 1,
    "explain": "재생에너지도 설비를 만들고 설치할 때 자원과 공간이 필요해요. 환경 영향을 살피면서 효율적으로 이용해야 해요.",
    "card": "재생에너지도 환경 영향을 고려해 이용해요.",
    "why": "발전 설비의 제작·운영·폐기 과정까지 함께 살펴보는 것이 좋아요."
  },
  {
    "id": "g5-life-01",
    "audience": "g5",
    "unit": "g5-life",
    "kind": "choice",
    "emoji": "🧪",
    "question": "같은 거리를 두 자동차가 달렸어요. 시간이 더 짧게 걸린 자동차는?",
    "choices": [
      "평균 속력이 더 작아요",
      "항상 같은 속력이에요",
      "평균 속력이 더 커요",
      "속력을 비교할 수 없어요"
    ],
    "answer": 2,
    "explain": "평균 속력은 이동한 거리를 걸린 시간으로 나누어 구해요. 같은 거리를 더 짧은 시간에 가면 평균 속력이 커요.",
    "card": "같은 거리에서는 시간이 짧을수록 평균 속력이 커요.",
    "experimentId": "science-car-speed",
    "why": "같은 시간이라면 더 멀리 간 물체의 평균 속력이 커요."
  },
  {
    "id": "g5-life-02",
    "audience": "g5",
    "unit": "g5-life",
    "kind": "choice",
    "emoji": "🧪",
    "question": "장애물 길의 경사면을 더 가파르게 만들었어요. 자동차 움직임을 공정하게 비교하려면?",
    "choices": [
      "자동차 종류와 길이도 바꾸어요",
      "빠른 차만 힘껏 밀어요",
      "걸린 시간은 재지 않아요",
      "같은 자동차를 같은 길이의 길에서 밀지 않고 놓아요"
    ],
    "answer": 3,
    "explain": "경사면 기울기의 영향을 보려면 다른 조건은 같게 해야 해요. 같은 자동차를 정해진 위치에서 놓고 걸린 시간을 비교해요.",
    "card": "비교 실험에서는 바꿀 조건 외의 조건을 같게 해요.",
    "experimentId": "science-ramp",
    "why": "마찰이나 바퀴 상태도 결과에 영향을 줄 수 있으므로 기록해요."
  },
  {
    "id": "g5-life-03",
    "audience": "g5",
    "unit": "g5-life",
    "kind": "ox",
    "emoji": "🧪",
    "question": "보라 양배추 색 물에 식초를 넣으면 색이 변할 수 있어요.",
    "choices": [
      "O",
      "X"
    ],
    "answer": 0,
    "explain": "양배추의 색소는 용액의 산성 정도에 따라 색이 달라질 수 있어요. 식초를 넣으면 보통 붉은 계열로 변해요.",
    "card": "양배추 색소는 용액의 성질에 따라 색이 변해요.",
    "experimentId": "science-cabbage",
    "why": "색 변화 관찰은 용액을 맛보지 않고 성질을 비교하는 방법이에요."
  },
  {
    "id": "g5-life-04",
    "audience": "g5",
    "unit": "g5-life",
    "kind": "choice",
    "emoji": "🧪",
    "question": "식초와 베이킹소다를 소량 섞을 때 생기는 기체는?",
    "choices": [
      "이산화 탄소",
      "산소만",
      "헬륨",
      "질소만"
    ],
    "answer": 0,
    "explain": "식초와 베이킹소다가 반응하면 이산화 탄소가 생겨요. 이 기체가 밖으로 나가며 거품이 보여요.",
    "card": "식초와 베이킹소다의 반응에서 이산화 탄소가 생겨요.",
    "experimentId": "science-gas-balloon",
    "why": "기체가 생기는 반응은 압력이 높아지지 않도록 보호자와 안전한 조건에서 관찰해요."
  }
];

export const SCIENCE_QUESTION_MAP: Record<string, ScienceQuestion> = Object.assign(Object.create(null), Object.fromEntries(SCIENCE_QUESTIONS.map(q => [q.id, q])));
