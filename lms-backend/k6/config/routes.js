export const routes = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
  },
  students: {
    list: "/students",
    create: "/students",
    detail: (id) => `/students/${id}`,
  },
  classes: {
    list: "/classes",
    create: "/classes",
    detail: (id) => `/classes/${id}`,
  },
  enrollments: {
    list: "/enrollments",
    create: "/enrollments",
    detail: (id) => `/enrollments/${id}`,
  },
  members: {
    list: "/members",
    create: "/members",
    detail: (id) => `/members/${id}`,
  },
  courses: {
    list: "/courses",
    create: "/courses",
    detail: (id) => `/courses/${id}`,
  },
};
