import * as vscode from 'vscode';

const BACKEND_URL = 'http://localhost:8080';

export function activate(context: vscode.ExtensionContext) {
    console.log('DevSkill Evaluator 확장 프로그램이 활성화되었습니다.');

    // "문제 시작하기" 명령어 등록
    let disposable = vscode.commands.registerCommand('devskill-evaluator.startChallenge', async () => {
        // 문제 선택
        const problemId = await vscode.window.showQuickPick(
            [
                { label: '문제 1: 두 수의 합 구하기', id: '1' },
                { label: '문제 2: HTTP 서버 만들기', id: '2' }
            ],
            { placeHolder: '풀고 싶은 문제를 선택하세요' }
        );

        if (!problemId) {
            return;
        }

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

        // 문제 데이터 가져오기
        try {
            const response = await fetch(`${BACKEND_URL}/problem/${problemId.id}`);
            const problem = await response.json();

            // 웹뷰 HTML 설정
            panel.webview.html = getWebviewContent(problem);

            // 웹뷰로부터 메시지 수신 처리
            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'submitCode':
                            await handleCodeSubmission(panel, problemId.id, message.runtime);
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );
        } catch (error) {
            vscode.window.showErrorMessage('문제를 불러올 수 없습니다: ' + error);
        }
    });

    context.subscriptions.push(disposable);
}

/**
 * 코드 제출 처리 함수
 */
async function handleCodeSubmission(panel: vscode.WebviewPanel, problemId: string, runtime: string) {
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

    // 제출 중 표시
    panel.webview.postMessage({
        command: 'submitting'
    });

    try {
        // 백엔드 API로 코드 제출
        const response = await fetch(`${BACKEND_URL}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                problem_id: problemId,
                code: code,
                runtime: runtime || 'nodejs'
            })
        });

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const result = await response.json() as any;
        
        // 결과에 따라 알림 표시
        if (result.success && result.score === 100) {
            vscode.window.showInformationMessage(`🎉 ${result.message} (점수: ${result.score}/100)`);
        } else if (result.success && result.score > 0) {
            vscode.window.showWarningMessage(`${result.message} (점수: ${result.score}/100)`);
        } else {
            vscode.window.showErrorMessage(`${result.message}`);
        }
        
        // 웹뷰에 결과 전달
        panel.webview.postMessage({
            command: 'submissionResult',
            result: result
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        vscode.window.showErrorMessage(`❌ 제출 중 오류가 발생했습니다: ${errorMessage}`);
        
        panel.webview.postMessage({
            command: 'submissionResult',
            result: {
                success: false,
                message: errorMessage
            }
        });
    }
}

/**
 * 웹뷰 HTML 콘텐츠 생성
 */
function getWebviewContent(problem: any) {
    const isServerProblem = problem.id === '2';
    
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
                h2 {
                    color: var(--vscode-editor-foreground);
                    margin-top: 20px;
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
                    margin-right: 10px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .info-box {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textLink-activeForeground);
                    padding: 10px 15px;
                    margin: 15px 0;
                }
                .result-box {
                    margin-top: 20px;
                    padding: 15px;
                    border-radius: 4px;
                }
                .result-success {
                    background-color: rgba(0, 255, 0, 0.1);
                    border: 1px solid rgba(0, 255, 0, 0.3);
                }
                .result-partial {
                    background-color: rgba(255, 165, 0, 0.1);
                    border: 1px solid rgba(255, 165, 0, 0.3);
                }
                .result-fail {
                    background-color: rgba(255, 0, 0, 0.1);
                    border: 1px solid rgba(255, 0, 0, 0.3);
                }
                .test-result {
                    font-family: 'Courier New', monospace;
                    margin: 5px 0;
                }
                .test-pass {
                    color: #4ec9b0;
                }
                .test-fail {
                    color: #f48771;
                }
                .ai-review {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid #569cd6;
                    padding: 15px;
                    margin: 15px 0;
                    white-space: pre-wrap;
                }
                select {
                    background-color: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    padding: 5px 10px;
                    margin: 10px 0;
                    font-size: 14px;
                }
                .loading {
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <h1>${problem.title}</h1>
            <div id="description">${problem.description}</div>
            
            <div class="info-box">
                <strong>📝 작업 방법:</strong><br>
                1. 아래 코드 템플릿을 복사하여 새 파일에 붙여넣으세요.<br>
                2. 문제 요구사항에 맞게 코드를 작성하세요.<br>
                3. 작성한 파일을 VS Code에서 열어둔 상태로 '제출' 버튼을 클릭하세요.
            </div>

            ${isServerProblem ? `
            <div class="info-box">
                <strong>🔧 런타임 선택:</strong><br>
                <select id="runtimeSelect">
                    <option value="nodejs">Node.js</option>
                    <option value="deno">Deno</option>
                    <option value="bun">Bun</option>
                </select>
            </div>
            ` : ''}

            <h2>📋 코드 템플릿</h2>
            <div id="template">${problem.template}</div>
            
            <button id="submitBtn">현재 파일 제출하기</button>
            
            <div id="result"></div>

            <script>
                const vscode = acquireVsCodeApi();
                const submitBtn = document.getElementById('submitBtn');
                const resultDiv = document.getElementById('result');
                const runtimeSelect = document.getElementById('runtimeSelect');

                // 제출 버튼 클릭 이벤트
                submitBtn.addEventListener('click', () => {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '제출 중...';
                    resultDiv.innerHTML = '<div class="loading">⏳ 코드를 평가하고 있습니다...</div>';
                    
                    const runtime = runtimeSelect ? runtimeSelect.value : 'nodejs';
                    
                    // VS Code 확장 프로그램에 제출 요청
                    vscode.postMessage({ 
                        command: 'submitCode',
                        runtime: runtime
                    });
                });

                // 확장 프로그램으로부터 메시지 수신
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.command === 'submitting') {
                        submitBtn.disabled = true;
                        submitBtn.textContent = '제출 중...';
                        resultDiv.innerHTML = '<div class="loading">⏳ 코드를 평가하고 있습니다...</div>';
                    }
                    
                    if (message.command === 'submissionResult') {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '현재 파일 제출하기';
                        
                        const result = message.result;
                        
                        if (!result.success) {
                            resultDiv.innerHTML = '<div class="result-box result-fail"><strong>❌ 오류</strong><br>' + result.message + '</div>';
                            return;
                        }

                        let resultClass = 'result-fail';
                        let emoji = '❌';
                        if (result.score === 100) {
                            resultClass = 'result-success';
                            emoji = '🎉';
                        } else if (result.score > 0) {
                            resultClass = 'result-partial';
                            emoji = '⚠️';
                        }

                        let html = '<div class="result-box ' + resultClass + '">';
                        html += '<h2>' + emoji + ' ' + result.message + '</h2>';
                        html += '<p><strong>점수: ' + result.score + '/100</strong></p>';
                        
                        if (result.test_results && result.test_results.length > 0) {
                            html += '<h3>테스트 결과:</h3>';
                            result.test_results.forEach(test => {
                                const isPassed = test.startsWith('PASS');
                                const className = isPassed ? 'test-pass' : 'test-fail';
                                html += '<div class="test-result ' + className + '">' + test + '</div>';
                            });
                        }

                        if (result.execution_log) {
                            html += '<h3>실행 로그:</h3>';
                            html += '<pre>' + result.execution_log + '</pre>';
                        }

                        if (result.ai_review) {
                            html += '<h3>🤖 AI 코드 리뷰:</h3>';
                            html += '<div class="ai-review">' + result.ai_review + '</div>';
                        }

                        html += '</div>';
                        resultDiv.innerHTML = html;
                    }
                });
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}

