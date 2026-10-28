import { Button } from "../components/Button";
import { PageIntro } from "../components/PageIntro";

export function NotFoundPage() {
  return (
    <div className="page">
      <PageIntro title="화면을 찾을 수 없습니다" lede="주소가 바뀌었거나 없는 경로입니다." />
      <Button to="/">대시보드로</Button>
    </div>
  );
}
