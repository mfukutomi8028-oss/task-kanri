  $("copySchedule")?.addEventListener("click", () => {
    const id = $("scheduleId").value;
    const schedule = state.schedules.find(item => item.id === id);
    if (!schedule) return toast("保存済みの予定をコピーできます", true);
    elements.scheduleDialog.close();
    openScheduleCopyDialog(schedule);
  });
  $("closeScheduleCopyDialog")?.addEventListener("click", () => closeScheduleCopyDialog(true));
  $("scheduleCopyBack")?.addEventListener("click", () => closeScheduleCopyDialog(true));
  $("scheduleCopyDialog")?.addEventListener("cancel", event => {
    event.preventDefault();
    closeScheduleCopyDialog(true);
  });
  $("scheduleCopyMethod")?.addEventListener("change", syncScheduleCopyUi);
  $("scheduleCopyStartDate")?.addEventListener("change", syncScheduleCopyPreview);
  $("scheduleCopyInterval")?.addEventListener("input", syncScheduleCopyPreview);
  $("scheduleCopyMonthDay")?.addEventListener("input", syncScheduleCopyPreview);
  $("scheduleCopyNth")?.addEventListener("change", syncScheduleCopyPreview);
  $("scheduleCopyNthWeekday")?.addEventListener("change", syncScheduleCopyPreview);
  $("scheduleCopyEndMode")?.addEventListener("change", syncScheduleCopyUi);
  $("scheduleCopyCount")?.addEventListener("input", syncScheduleCopyPreview);
  $("scheduleCopyEndDate")?.addEventListener("change", syncScheduleCopyPreview);
  document.querySelectorAll("[data-copy-weekday]").forEach(input => input.addEventListener("change", syncScheduleCopyPreview));
  $("scheduleCopyAddDate")?.addEventListener("click", addScheduleCopyDateFromInput);
  $("scheduleCopyDateList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-copy-date]");
    if (!button) return;
    scheduleCopySelectedDates.delete(button.dataset.removeCopyDate);
    renderScheduleCopySelectedDates();
    syncScheduleCopyPreview();
  });
  $("scheduleCopyForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    await submitScheduleCopy();
  });
