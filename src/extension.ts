import * as vscode from 'vscode';

const BACKEND_URL = 'http://localhost:8080';

export function activate(context: vscode.ExtensionContext) {
    console.log('DevSkill Evaluator 확장 프로그램이 활성화되었습니다.');

    // "문제 시작하기" 명령어 등록
    let disposable = vscode.commands.registerCommand('devskill-evaluator.startChallenge', () => {
        // 웹뷰 패널 생성
        const panel = vscode.window.createWebviewPanel(
            'devskillChallenge',
            'DevSkill Challenge',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // 웹뷰 HTML 설정
        panel.webview.html = getWebviewContent();

        // 웹뷰로부터 메시지 수신 처리
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'submitCode':
                        await handleCodeSubmission(panel);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

/**
 * 코드 제출 처리 함수
 */
async function handleCodeSubmission(panel: vscode.WebviewPanel) {
    // 현재 활성화된 에디터 가져오기
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('제출할 파일이 열려있지 않습니다. 코드를 작성한 파일을 먼저 열어주세요.');
        return;
    }

    // 현재 에디터의 전체 텍스트 가져오기
    const code = editor.document.getText();

    if (!code.trim()) {
        vscode.window.showWarningMessage('제출할 코드가 비어있습니다.');
        return;
    }

    try {
        // 백엔드 API로 코드 제출
        const response = await fetch(`${BACKEND_URL}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code })
        });

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const result = await response.json() as { message: string; status: string };
        
        // 성공 메시지 표시
        vscode.window.showInformationMessage(`✅ ${result.message}`);
        
        // 웹뷰에도 성공 메시지 전달
        panel.webview.postMessage({
            command: 'submissionResult',
            success: true,
            message: result.message
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        vscode.window.showErrorMessage(`❌ 제출 중 오류가 발생했습니다: ${errorMessage}`);
        
        panel.webview.postMessage({
            command: 'submissionResult',
            success: false,
            message: errorMessage
        });
    }
}

/**
 * 웹뷰 HTML 콘텐츠 생성
 */
function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DevSkill Challenge</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h1 {
                    color: var(--vscode-editor-foreground);
                    border-bottom: 2px solid var(--vscode-textLink-foreground);
                    padding-bottom: 10px;
                }
                #description {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textLink-foreground);
                    padding: 15px;
                    margin: 20px 0;
                    white-space: pre-wrap;
                }
                #template {
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    padding: 15px;
                    margin: 20px 0;
                    font-family: 'Courier New', monospace;
                    white-space: pre-wrap;
                    overflow-x: auto;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    font-size: 14px;
                    cursor: pointer;
                    border-radius: 4px;
                    margin-top: 10px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .loading {
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }
                .error {
                    color: var(--vscode-errorForeground);
                    background-color: var(--vscode-inputValidation-errorBackground);
                    padding: 10px;
                    border-radius: 4px;
                    margin: 10px 0;
                }
                .success {
                    color: var(--vscode-terminal-ansiGreen);
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 10px;
                    border-radius: 4px;
                    margin: 10px 0;
                }
                .info-box {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textLink-activeForeground);
                    padding: 10px 15px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <h1 id="title">문제를 불러오는 중...</h1>
            <div id="description" class="loading">문제 설명을 가져오고 있습니다...</div>
            
            <div class="info-box">
                <strong>📝 작업 방법:</strong><br>
                1. 아래 코드 템플릿을 복사하여 새 파일에 붙여넣으세요.<br>
                2. 문제 요구사항에 맞게 코드를 작성하세요.<br>
                3. 작성한 파일을 VS Code에서 열어둔 상태로 '제출' 버튼을 클릭하세요.
            </div>

            <h3>📋 코드 템플릿</h3>
            <div id="template" class="loading">템플릿을 가져오고 있습니다...</div>
            
            <button id="submitBtn" disabled>현재 파일 제출하기</button>
            <div id="result"></div>

            <script>
                const vscode = acquireVsCodeApi();
                const submitBtn = document.getElementById('submitBtn');
                const resultDiv = document.getElementById('result');

                // 페이지 로드 시 백엔드에서 문제 정보 가져오기
                window.addEventListener('load', async () => {
                    try {
                        const response = await fetch('${BACKEND_URL}/problem/1');
                        
                        if (!response.ok) {
                            throw new Error('문제를 불러올 수 없습니다.');
                        }
                        
                        const data = await response.json();
                        
                        // 문제 정보 표시
                        document.getElementById('title').textContent = data.title;
                        document.getElementById('description').textContent = data.description;
                        document.getElementById('description').className = '';
                        document.getElementById('template').textContent = data.template;
                        document.getElementById('template').className = '';
                        
                        // 제출 버튼 활성화
                        submitBtn.disabled = false;
                        
                    } catch (error) {
                        document.getElementById('title').textContent = '오류 발생';
                        document.getElementById('description').innerHTML = 
                            '<div class="error">❌ ' + error.message + '<br><br>백엔드 서버가 실행 중인지 확인해주세요.</div>';
                        document.getElementById('description').className = '';
                    }
                });

                // 제출 버튼 클릭 이벤트
                submitBtn.addEventListener('click', () => {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '제출 중...';
                    resultDiv.innerHTML = '';
                    
                    // VS Code 확장 프로그램에 제출 요청
                    vscode.postMessage({ command: 'submitCode' });
                });

                // 확장 프로그램으로부터 메시지 수신
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.command === 'submissionResult') {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '현재 파일 제출하기';
                        
                        if (message.success) {
                            resultDiv.innerHTML = '<div class="success">✅ ' + message.message + '</div>';
                        } else {
                            resultDiv.innerHTML = '<div class="error">❌ ' + message.message + '</div>';
                        }
                    }
                });
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}

