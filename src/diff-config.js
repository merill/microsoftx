(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.MICROSOFTX_DIFF_CONFIG = config;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    sources: [
      {
        id: 'graph-api-beta',
        label: 'Microsoft Graph',
        siteUrl: 'https://learn.microsoft.com/graph/api/',
        stripLocale: true,
        query: { view: 'graph-rest-beta' },
        repositoryUrl: 'https://github.com/microsoftgraph/microsoft-graph-docs-contrib',
        repositoryPathPrefix: 'api-reference/beta/api',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'graph-api-v1',
        label: 'Microsoft Graph',
        siteUrl: 'https://learn.microsoft.com/graph/api/',
        stripLocale: true,
        query: { view: 'graph-rest-1.0' },
        repositoryUrl: 'https://github.com/microsoftgraph/microsoft-graph-docs-contrib',
        repositoryPathPrefix: 'api-reference/v1.0/api',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'graph-api-default',
        label: 'Microsoft Graph',
        siteUrl: 'https://learn.microsoft.com/graph/api/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/microsoftgraph/microsoft-graph-docs-contrib',
        repositoryPathPrefix: 'api-reference/v1.0/api',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'fabric-get-started',
        label: 'Microsoft Fabric',
        siteUrl: 'https://learn.microsoft.com/fabric/get-started/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/fabric-docs',
        repositoryPathPrefix: 'docs/fundamentals',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'entra-learn',
        label: 'Microsoft Entra',
        siteUrl: 'https://learn.microsoft.com/entra/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/entra-docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'azure-learn',
        label: 'Azure',
        siteUrl: 'https://learn.microsoft.com/azure/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/azure-docs',
        repositoryPathPrefix: 'articles',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'dotnet-learn',
        label: '.NET',
        siteUrl: 'https://learn.microsoft.com/dotnet/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/dotnet/docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'powershell-learn',
        label: 'PowerShell',
        siteUrl: 'https://learn.microsoft.com/powershell/scripting/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/PowerShell-Docs',
        repositoryPathPrefix: 'reference/docs-conceptual',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'microsoft-365-learn',
        label: 'Microsoft 365',
        siteUrl: 'https://learn.microsoft.com/microsoft-365/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/microsoft-365-docs',
        repositoryPathPrefix: 'microsoft-365',
        defaultBranch: 'public',
        fileExtension: '.md'
      },
      {
        id: 'intune-learn',
        label: 'Microsoft Intune',
        siteUrl: 'https://learn.microsoft.com/mem/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/memdocs',
        repositoryPathPrefix: '',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'fabric-learn',
        label: 'Microsoft Fabric',
        siteUrl: 'https://learn.microsoft.com/fabric/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/fabric-docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'dynamics-365-learn',
        label: 'Dynamics 365',
        siteUrl: 'https://learn.microsoft.com/dynamics365/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/dynamics365hubpages',
        repositoryPathPrefix: 'dynamics365',
        defaultBranch: 'live',
        fileExtension: '.md'
      },
      {
        id: 'sql-learn',
        label: 'SQL',
        siteUrl: 'https://learn.microsoft.com/sql/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/sql-docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'live',
        fileExtension: '.md'
      },
      {
        id: 'graph-concepts',
        label: 'Microsoft Graph',
        siteUrl: 'https://learn.microsoft.com/graph/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/microsoftgraph/microsoft-graph-docs-contrib',
        repositoryPathPrefix: 'concepts',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'visual-studio-learn',
        label: 'Visual Studio',
        siteUrl: 'https://learn.microsoft.com/visualstudio/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/visualstudio-docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'aspnet-core-learn',
        label: 'ASP.NET Core',
        siteUrl: 'https://learn.microsoft.com/aspnet/core/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/dotnet/AspNetCore.Docs',
        repositoryPathPrefix: 'aspnetcore',
        pathAliases: { 'introduction-to-aspnet-core': 'overview' },
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'windows-server-learn',
        label: 'Windows Server',
        siteUrl: 'https://learn.microsoft.com/windows-server/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/windowsserverdocs',
        repositoryPathPrefix: 'WindowsServerDocs',
        defaultBranch: 'main',
        fileExtension: '.md'
      }
    ]
  };
}));
