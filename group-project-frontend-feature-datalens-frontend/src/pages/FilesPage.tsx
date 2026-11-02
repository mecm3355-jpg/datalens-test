import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { FILE_CATEGORY_LABEL, FILE_STATUS_LABEL } from "../lib/labels";
import { formatBytes, formatDate, formatNumber } from "../lib/format";
import { useCatalog } from "../state/catalog";

const ACCEPT = ".csv,.tsv,.xlsx,.xls,.docx,.pdf,.txt,.jpg,.jpeg,.png,.hwpx,.hwp";

export function FilesPage() {
  const { files, uploadFiles, status } = useCatalog();

  return (
    <div className="page">
      <PageIntro
        eyebrow="입력"
        title="파일"
        lede="원문을 올리면 형식 검증과 추출 대상으로 쌓입니다. 컬럼 매핑을 확인한 뒤 분석을 실행합니다."
      />
      <label className="upload-zone">
        <input
          className="upload-input"
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(event) => {
            const picked = event.target.files;
            if (!picked || picked.length === 0) return;
            void uploadFiles([...picked]);
            event.target.value = "";
          }}
        />
        <span className="title-sm">원문 파일 올리기</span>
        <span className="caption">CSV, TSV, XLSX, XLS, DOCX, PDF, TXT, JPG, PNG, HWPX</span>
        <span className="btn btn-primary">파일 선택</span>
      </label>
      <DataTable
        rows={files}
        rowKey={(file) => file.id}
        empty={status === "loading" ? "파일 목록을 불러오는 중입니다." : "올린 파일이 없습니다."}
        columns={[
          {
            key: "name",
            header: "파일",
            render: (file) => (
              <Link className="link" to={`/files/${file.id}`}>
                {file.originalName}
              </Link>
            ),
          },
          { key: "kind", header: "형식", render: (file) => FILE_CATEGORY_LABEL[file.fileCategory] },
          { key: "size", header: "크기", numeric: true, render: (file) => formatBytes(file.sizeBytes) },
          {
            key: "rows",
            header: "행",
            numeric: true,
            render: (file) => (file.rowCount === null ? "—" : formatNumber(file.rowCount)),
          },
          {
            key: "status",
            header: "상태",
            render: (file) => <span className="pill">{FILE_STATUS_LABEL[file.status]}</span>,
          },
          { key: "date", header: "올린 날", numeric: true, render: (file) => formatDate(file.createdAt) },
        ]}
      />
    </div>
  );
}
