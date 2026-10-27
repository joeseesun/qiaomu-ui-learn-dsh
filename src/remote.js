export function remoteApi(service, methods) {
  return Object.fromEntries(
    methods.map((name) => [
      name,
      async (...args) => {
        const result = await service[name](...args);
        if (result?.ok === true) return result.value;
        const error = result?.error;
        throw new Error(
          typeof error === "string"
            ? error
            : error?.message || `Host operation failed: ${name}`,
        );
      },
    ]),
  );
}
