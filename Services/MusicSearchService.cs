using Microsoft.JSInterop;
using MusicWeb.Data;

namespace MusicWeb.Services;

public sealed class MusicSearchService(IJSRuntime jsRuntime)
{
    private IJSObjectReference? _module;

    public async Task InitializeAsync()
    {
        _module ??= await jsRuntime.InvokeAsync<IJSObjectReference>("import", "./js/musicSearchInterop.js");
        await _module.InvokeVoidAsync("ensureReady");
    }

    public async Task<MusicSearchResult> SearchAsync(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return new MusicSearchResult();
        }

        await InitializeAsync();
        return await _module!.InvokeAsync<MusicSearchResult>("search", query);
    }
}
