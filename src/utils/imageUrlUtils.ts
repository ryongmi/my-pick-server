/**
 * 이미지 URL 유틸리티
 * 외부 플랫폼(YouTube, Twitter 등)의 콘텐츠 이미지 URL을 my-pick-server의 프록시 URL로 변환
 */

/**
 * 외부 이미지 URL을 프록시 URL로 변환
 *
 * @param externalUrl 외부 이미지 URL (예: https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg)
 * @returns 프록시 URL (예: http://localhost:8300/api/proxy/image?url=...)
 *
 * @example
 * // 개발 환경
 * convertToProxyUrl('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
 * // => 'http://localhost:8300/api/proxy/image?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2FdQw4w9WgXcQ%2Fmaxresdefault.jpg'
 *
 * @example
 * // null/undefined 처리
 * convertToProxyUrl(null) // => null
 * convertToProxyUrl(undefined) // => null
 *
 * @example
 * // 이미 프록시 URL인 경우
 * convertToProxyUrl('http://localhost:8300/api/proxy/image?url=...')
 * // => 'http://localhost:8300/api/proxy/image?url=...' (그대로 반환)
 */
export function convertToProxyUrl(externalUrl: string | null | undefined): string | null {
  // null/undefined 처리
  if (!externalUrl) {
    return null;
  }

  // 환경변수에서 my-pick-server URL 가져오기
  const myPickServerUrl = process.env.MY_PICK_SERVER_URL || 'http://localhost:8300';

  // 이미 프록시 URL인 경우 그대로 반환
  if (externalUrl.startsWith(myPickServerUrl)) {
    return externalUrl;
  }

  // 외부 URL을 프록시 URL로 변환
  const encodedUrl = encodeURIComponent(externalUrl);
  return `${myPickServerUrl}/api/proxy/image?url=${encodedUrl}`;
}
