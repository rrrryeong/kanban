# Database Design — Supabase PostgreSQL

## 사용자 보드
public.boards: user_id UUID PK REFERENCES auth.users(id) ON DELETE CASCADE, data JSONB NOT NULL, revision bigint NOT NULL, updated_at timestamptz NOT NULL. 사용자당 하나. 보드 JSON은 version=1, cards 맵, todo/in-progress/done 배열 구조를 유지한다. 카드 id/title/description/createdAt/updatedAt, 제목 1~100자와 설명 최대 1000자, 유일한 카드 참조와 누락 없는 순서를 서버에서도 검증한다.

## 권한과 저장
RLS SELECT/INSERT/UPDATE는 authenticated 본인만 허용. 익명·타인 데이터 차단. 쓰기는 RPC만 허용하며 user_id는 auth.uid()에서 결정한다. revision은 서버에서 1씩 증가. save_board는 예상 revision 비교와 UPDATE를 원자적으로 수행한다. create_board는 중복 생성에도 기존 행을 보존한다. import_board는 행 잠금과 빈 보드 확인을 한 트랜잭션에서 수행한다. 일반 클라이언트의 직접 테이블 쓰기 권한은 부여하지 않는다.

## 로컬 데이터 이전
kanban.board는 이전 원본으로만 읽고 클라우드 보드가 비었을 때 미리보기/확인을 제공한다. 검증 실패 원본은 가져오지 않는다. 업로드 성공 후 사용자별 완료 표시만 남긴다. 원본은 삭제하지 않는다. 다른 계정 자동 이전 금지. 로컬 캐시에 보드를 저장하지 않는다. 세션은 Supabase SDK에서 관리한다.

## 충돌·장애
stale revision이면 충돌 오류. 자동 재저장·덮어쓰기 없음. 불러오기 실패/손상은 오류로 표시하고 빈 보드를 저장하지 않는다. 오프라인 쓰기 없음. 다른 기기는 다음 조회에서 반영된다.
