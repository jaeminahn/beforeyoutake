# 타기전에 (Before You Take)

**타기전에**는 시간 제약 하 비용 최소화(**Time-Constrained Cost Minimization**) 문제를 실시간으로 해결하는 멀티모달 경로 탐색 서비스입니다. 본 시스템은 사용자의 제약 조건을 충족하는 비용 효율적 경로를 찾는 것을 목표로 합니다.

---

## 1. 문제 정의 (Formal Formulation)

본 시스템은 그래프 $G = (V, E)$ 환경에서 **Constrained Shortest Path Problem (CSPP)**을 해결합니다.

### 구성 요소
- **$V$**: 지리적 위치 노드
- **$E$**: 이동 엣지 (Transit: 버스/지하철/도보, Taxi: 자동차 기반 point-to-point)
- **Edge 비용 벡터**: $e = (\delta_t, \delta_c, \delta_w)$
    - $\delta_t$: 시간 증가량
    - $\delta_c$: 비용 증가량
    - $\delta_w$: 도보 시간 증가량

### 제약 조건 및 목적 함수
사용자가 지정한 도착 제한 시간 $T_{max}$ 및 최대 도보 시간 $W_{max}$를 만족하는 경로 집합 $\Omega$에 대하여:

1. **제약 조건**: 
   $$\sum \delta_t \le T_{max}$$
   $$\sum \delta_w \le W_{max}$$
2. **목적 함수**: 
   $$\text{minimize } \sum \delta_c$$

---

## 2. 탐색 공간 축소 전략

실시간 API 환경의 한계를 극복하기 위해 **Transit-Itinerary-Driven Skeleton** 전략을 사용합니다.

- **전략**: TMAP Transit API가 반환하는 $k$개의 itinerary를 상위 레벨 경로 skeleton으로 활용합니다.
- **제한**: Taxi는 해당 경로의 일부 구간을 치환(substitution)하는 방식으로만 허용됩니다.
- **복잡도**: $O(k)$ 수준으로 제한하여 실시간 응답성을 보장합니다.

---

## 3. 후보 생성 구조 (Candidate Generation)

각 Transit Itinerary $I_i$에 대해 다음과 같은 후보군을 생성합니다.



### 3.1 Transit-only (Baseline)
- $T_i, C_i, W_i$를 산출하여 모든 혼합 경로의 비교 기준(Reference Frontier)으로 사용합니다.

### 3.2 Taxi-only
- Origin $\rightarrow$ Destination 자동차 경로 ($W_{taxi} = 0$).
- 시간 절약의 상한선 및 비용 비교 기준으로 작동합니다.

### 3.3 Mixed Routes (Local Edge Substitution)
- **(A) Taxi $\rightarrow$ Transit**: Origin $\rightarrow$ First board node (Taxi) + Board node $\rightarrow$ Destination (Transit)
- **(B) Transit $\rightarrow$ Taxi**: Origin $\rightarrow$ Last alight node (Transit) + Alight node $\rightarrow$ Destination (Taxi)
- 전역 탐색이 아닌 **Local prefix/suffix substitution** 전략을 취합니다.

---

## 4. 필터링 및 최적화 프로세스

### 4.1 Feasibility Filtering
각 후보 경로 $P_j$가 다음을 만족하지 않으면 제거하여 실행 가능 집합 $\Omega$를 형성합니다.
- $T_j \le T_{max}$ AND $W_j \le W_{max}$

### 4.2 Dominance Pruning (Pareto Efficiency)
경로 $A$가 $B$를 지배($A \prec B$)하는 경우 $B$를 제거합니다.
- $T_A \le T_B, C_A \le C_B, W_A \le W_B$ (최소 하나는 Strict Inequality)

### 4.3 최종 경로 선택 (Cost Minimization)
집합 $\Omega$ 내에서 다음 우선순위로 정렬하여 최적 경로를 제안합니다.
1. `totalCostKrw` 오름차순 (비용 최소화가 1차 목표)
2. 동일 비용 시 `totalTimeMin` 오름차순

---

## 5. 계산 복잡도 및 설계 제약

### 계산 복잡도
- Transit Itineraries 수 $k \le 10$ 일 때, Taxi API 호출 수는 $O(2k + 1)$입니다.
- 전체 성능은 외부 API Latency에 의해 결정됩니다.

### 구조적 제약 (Architectural Constraints)
- **Taxi segment count $\le 1$**: 경로 내 택시 이용은 1회로 제한됩니다.
- **Prefix/Suffix Only**: 택시 치환은 경로의 시작 또는 끝 구간에서만 허용됩니다.
- **중간 구간 삽입 금지**: 복잡도 제어를 위해 중간 구간의 임의 택시 삽입은 배제합니다.
