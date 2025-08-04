const core = require("@actions/core");
const github = require("@actions/github");

// Función para generar release notes automáticas
function generateReleaseNotes(pullRequest, commits, files) {
  const features = [];
  const fixes = [];
  const chores = [];
  const others = [];

  // Analizar commits por tipo
  commits.forEach((commit) => {
    const message = commit.commit.message.toLowerCase();
    const fullMessage = commit.commit.message;

    if (message.startsWith("feat:") || message.startsWith("feature:")) {
      features.push(fullMessage.replace(/^(feat:|feature:)\s*/i, ""));
    } else if (message.startsWith("fix:") || message.startsWith("bug:")) {
      fixes.push(fullMessage.replace(/^(fix:|bug:)\s*/i, ""));
    } else if (
      message.startsWith("chore:") ||
      message.startsWith("docs:") ||
      message.startsWith("style:")
    ) {
      chores.push(fullMessage.replace(/^(chore:|docs:|style:)\s*/i, ""));
    } else {
      others.push(fullMessage);
    }
  });

  // Analizar archivos modificados
  const addedFiles = files
    .filter((f) => f.status === "added")
    .map((f) => f.filename);
  const modifiedFiles = files
    .filter((f) => f.status === "modified")
    .map((f) => f.filename);
  const deletedFiles = files
    .filter((f) => f.status === "removed")
    .map((f) => f.filename);

  // Generar release notes
  let releaseNotes = `# Release Notes\n\n`;

  // Información del PR
  if (pullRequest.title) {
    releaseNotes += `## ${pullRequest.title}\n\n`;
  }

  if (pullRequest.body && pullRequest.body.trim()) {
    releaseNotes += `${pullRequest.body}\n\n`;
  }

  // Nuevas características
  if (features.length > 0) {
    releaseNotes += `## 🚀 Nuevas Características\n\n`;
    features.forEach((feature) => {
      releaseNotes += `- ${feature}\n`;
    });
    releaseNotes += `\n`;
  }

  // Correcciones
  if (fixes.length > 0) {
    releaseNotes += `## 🐛 Correcciones\n\n`;
    fixes.forEach((fix) => {
      releaseNotes += `- ${fix}\n`;
    });
    releaseNotes += `\n`;
  }

  // Otros cambios
  if (others.length > 0) {
    releaseNotes += `## 📝 Otros Cambios\n\n`;
    others.forEach((change) => {
      releaseNotes += `- ${change}\n`;
    });
    releaseNotes += `\n`;
  }

  // Tareas de mantenimiento
  if (chores.length > 0) {
    releaseNotes += `## 🔧 Mantenimiento\n\n`;
    chores.forEach((chore) => {
      releaseNotes += `- ${chore}\n`;
    });
    releaseNotes += `\n`;
  }

  // Archivos modificados
  if (
    addedFiles.length > 0 ||
    modifiedFiles.length > 0 ||
    deletedFiles.length > 0
  ) {
    releaseNotes += `## 📁 Archivos Afectados\n\n`;

    if (addedFiles.length > 0) {
      releaseNotes += `### ✅ Archivos Agregados\n`;
      addedFiles.forEach((file) => {
        releaseNotes += `- \`${file}\`\n`;
      });
      releaseNotes += `\n`;
    }

    if (modifiedFiles.length > 0) {
      releaseNotes += `### 📝 Archivos Modificados\n`;
      modifiedFiles.forEach((file) => {
        releaseNotes += `- \`${file}\`\n`;
      });
      releaseNotes += `\n`;
    }

    if (deletedFiles.length > 0) {
      releaseNotes += `### ❌ Archivos Eliminados\n`;
      deletedFiles.forEach((file) => {
        releaseNotes += `- \`${file}\`\n`;
      });
      releaseNotes += `\n`;
    }
  }

  // Información adicional
  releaseNotes += `---\n\n`;
  releaseNotes += `**Total de commits:** ${commits.length}\n`;
  releaseNotes += `**Archivos afectados:** ${files.length}\n`;

  if (pullRequest.user) {
    releaseNotes += `**Autor:** @${pullRequest.user.login}\n`;
  }

  return releaseNotes;
}

// Función para generar release notes usando Hugging Face AI
async function generateReleaseNotesWithAI(prompt, pullRequest, commits, files) {
  const huggingfaceToken = core.getInput("huggingface_token");

  if (!huggingfaceToken) {
    console.log(
      "Token de Hugging Face no proporcionado, usando generación automática sin IA"
    );
    return generateReleaseNotes(pullRequest, commits, files);
  }

  try {
    console.log("Generando release notes con Hugging Face AI...");

    const response = await fetch(
      "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${huggingfaceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_length: 500,
            temperature: 0.7,
            do_sample: true,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Hugging Face API error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`Hugging Face error: ${result.error}`);
    }

    let aiReleaseNotes =
      result[0]?.generated_text || result.generated_text || "";

    // Si la respuesta de IA está vacía o es muy corta, usar generación automática
    if (!aiReleaseNotes || aiReleaseNotes.trim().length < 50) {
      console.log("Respuesta de IA insuficiente, usando generación automática");
      return generateReleaseNotes(pullRequest, commits, files);
    }

    // Limpiar y formatear la respuesta de IA
    aiReleaseNotes = aiReleaseNotes.replace(prompt, "").trim();

    // Agregar información técnica al final
    aiReleaseNotes += `\n\n---\n\n**Información técnica:**\n`;
    aiReleaseNotes += `- Total de commits: ${commits.length}\n`;
    aiReleaseNotes += `- Archivos afectados: ${files.length}\n`;

    if (pullRequest.user) {
      aiReleaseNotes += `- Autor: @${pullRequest.user.login}\n`;
    }

    console.log("Release notes generadas exitosamente con IA");
    return aiReleaseNotes;
  } catch (error) {
    console.error(`Error al usar Hugging Face: ${error.message}`);
    console.log("Usando generación automática como respaldo");
    return generateReleaseNotes(pullRequest, commits, files);
  }
}

async function run() {
  try {
    const token = core.getInput("github_token");
    const prNumberInput = core.getInput("pr_number");
    const octokit = github.getOctokit(token);
    const context = github.context;

    // Determinar el número de PR a usar
    let prNumber;
    if (prNumberInput) {
      prNumber = parseInt(prNumberInput);
      console.log(`Usando PR número proporcionado: ${prNumber}`);
    } else if (context.payload.pull_request) {
      prNumber = context.payload.pull_request.number;
      console.log(`Usando PR número del evento: ${prNumber}`);
    } else {
      throw new Error(
        "No se pudo determinar el número de PR. Proporciona pr_number como input o ejecuta desde un evento de PR."
      );
    }

    // Obtener información del PR
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
    });

    // Obtener commits del PR
    const { data: commits } = await octokit.rest.pulls.listCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
    });

    // Obtener archivos modificados
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
    });

    // Obtener diff del PR
    const { data: diff } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      mediaType: {
        format: "diff",
      },
    });

    // Preparar prompt para Hugging Face
    const commitMessages = commits
      .map((c) => `- ${c.commit.message}`)
      .join("\n");
    const filesList = files
      .map((f) => `- ${f.filename} (${f.status})`)
      .join("\n");

    const prompt = `Genera release notes profesionales en español para este Pull Request:

Título: ${pullRequest.title}
Descripción: ${pullRequest.body || "Sin descripción"}

Commits:
${commitMessages}

Archivos modificados:
${filesList}

Incluye: resumen de cambios, nuevas características, correcciones y mejoras.`;

    // Usar Hugging Face para generar release notes con IA
    const releaseNotes = await generateReleaseNotesWithAI(
      prompt,
      pullRequest,
      commits,
      files
    );

    // Determinar el tag a usar
    const customVersion = core.getInput("version");
    let tagName;

    if (customVersion) {
      // Usar versión personalizada
      tagName = customVersion.startsWith("v")
        ? customVersion
        : `v${customVersion}`;
      console.log(`Usando versión personalizada: ${tagName}`);
    } else {
      // Generar tag basado en la fecha y hora actual
      const now = new Date();
      tagName = `v${now.getFullYear()}.${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}.${now.getDate().toString().padStart(2, "0")}-${now
        .getHours()
        .toString()
        .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}`;
      console.log(`Generando tag automático: ${tagName}`);
    }

    // Crear la release
    const release = await octokit.rest.repos.createRelease({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tag_name: tagName,
      name: `Release ${tagName}`,
      body: releaseNotes,
      draft: false,
      prerelease: false,
    });

    console.log(`Release creada exitosamente: ${release.data.html_url}`);
    core.setOutput("release_url", release.data.html_url);
    core.setOutput("tag_name", tagName);
  } catch (error) {
    console.error("Error:", error);
    core.setFailed(error.message);
  }
}

run();
