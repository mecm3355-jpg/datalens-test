/** 스캔 PDF 한 장을 렌더링할 해상도. 서버 OCR과 같은 300dpi(PDF 기본 단위는 72dpi)입니다. */
const RENDER_SCALE = 300 / 72;

/**
 * 스캔 PDF를 브라우저 안에서 OCR해 글자를 돌려줍니다. 파일 내용은 밖으로 나가지 않습니다.
 * 처음 한 번은 한국어 인식 데이터를 내려받습니다. 라이브러리가 커서 쓸 때만 불러옵니다.
 *
 * @param file 스캔 PDF 파일
 * @param onProgress 페이지 하나를 끝낼 때마다 (끝낸 쪽 수, 전체 쪽 수)로 불립니다.
 */
export async function readScannedPdf(
  file: File,
  onProgress: (done: number, total: number) => void,
): Promise<string> {
  const [{ getDocument, GlobalWorkerOptions }, { createWorker, PSM }, pdfWorker] = await Promise.all([
    import("pdfjs-dist"),
    import("tesseract.js"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = pdfWorker.default;

  const loading = getDocument({ data: await file.arrayBuffer() });
  const pdf = await loading.promise;
  const worker = await createWorker("kor");
  try {
    // 서버 OCR(--psm 4)과 같이 한 단짜리 문서로 읽어 줄 순서를 지킵니다.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    const pages: string[] = [];
    onProgress(0, pdf.numPages);
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const result = await worker.recognize(canvas);
      pages.push(result.data.text);
      page.cleanup();
      onProgress(number, pdf.numPages);
    }
    return pages.join("\n");
  } finally {
    await worker.terminate();
    await loading.destroy();
  }
}
